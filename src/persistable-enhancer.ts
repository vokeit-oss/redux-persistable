/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import * as Immutable from 'immutable';
const pickBy = require('lodash.pickby');
import {
    Action,
    Reducer,
    Store,
    StoreCreator,
    StoreEnhancer,
    StoreEnhancerStoreCreator
} from 'redux';
import { merger } from './mergers/index';
import { OptionsType } from './types/index';
import * as _ from 'lodash-es';
import * as constants from './constants';


export default function persistableEnhancer(options: OptionsType): StoreEnhancer<any> {
    const configuration: OptionsType = <OptionsType>{
        merger:     merger,
        storageKey: 'redux-persistable',
        ...options
    };
    
    if('object' !== typeof configuration.storage) {
        throw new Error('Expected enhancer option "storage" to be an object.');
    }
    else if('function' !== typeof configuration.storage.getItem || 'function' !== typeof configuration.storage.setItem || 'function' !== typeof configuration.storage.removeItem) {
        throw new Error('Expected enhancer option "storage" to be an object with functions "getItem", "setItem" and "removeItem".');
    }
    
    const getShapeAction: string                     = '@@redux-persistable/GET_SHAPE_' + Math.random().toString(36).substring(7).split('').join('.');
    const rehydratedSlices: {[key: string]: boolean} = {};
    const dispatchedSlices: string[]                 = [];
    const actionBuffer: any[]                        = [];
    
    return (nextCreateStore: StoreCreator): StoreEnhancerStoreCreator<any> => {
        return (reducer: Reducer<any>, initialState: any, enhancer?: StoreEnhancer<any>): Store<any> => {
            if('function' === typeof initialState && 'undefined' === typeof enhancer) {
                enhancer     = initialState;
                initialState = undefined;
            }
            
            const rehydrateSlices: (slices: {[key: string]: boolean}) => void = (slices: {[key: string]: boolean}): void => {
                try {
                    Object.keys(slices).forEach((slice: string): void => {
                        if(!slices[slice] && 0 > dispatchedSlices.indexOf(slice)) {
                            // Hack to prevent double-dispatching when replaceReducer() is called multiple times immediately after each other
                            dispatchedSlices.push(slice);
                            
                            configuration.storage.getItem(configuration.storageKey + '@' + slice).then((persistedState: any) => {
                                const currentState: any    = store.getState();
                                const isImmutable: boolean = Immutable.Iterable.isIterable(currentState);
                                const rehydratedState: any = configuration.merger(
                                    isImmutable ? currentState.get(slice) : currentState[slice],
                                    isImmutable ? persistedState.get(slice) : persistedState[slice]
                                );
                                
                                store.dispatch(<Action>{type: constants.REHYDRATED_SLICE_ACTION, slice: slice, payload: rehydratedState});
                            });
                        }
                    });
                }
                catch(error) {
                    console.warn('Failed to retrieve persisted state from storage:', error);
                }
            };
            
            // Create store
            const store: Store<any> = nextCreateStore(reducer, initialState, enhancer);
            
            // Wrap reducer to catch rehydrate action
            const originalReplaceReducer: (setReducer: Reducer<any>) => void = store.replaceReducer;
            store.replaceReducer                                             = (setReducer: Reducer<any>): void => {
                // Get the shape of the state to know which rehydrations have to be executed
                const currentState: any = setReducer(undefined, <Action>{type: getShapeAction});
                
                if(Immutable.Iterable.isIterable(currentState)) {
                    currentState.forEach((value: any, key: string): void => {
                        rehydratedSlices[key] = !rehydratedSlices.hasOwnProperty(key) ? false : rehydratedSlices[key];
                    });
                }
                else if('object' === typeof currentState && !Array.isArray(currentState)) {
                    Object.keys(currentState).forEach((key: string): void => {
                        rehydratedSlices[key] = !rehydratedSlices.hasOwnProperty(key) ? false : rehydratedSlices[key];
                    });
                }
                
                const originalReducer: Reducer<any> = setReducer;
                setReducer                          = (state: any, action: Action): any => {
                    if(constants.REHYDRATED_SLICE_ACTION === action.type) {
                        if(rehydratedSlices.hasOwnProperty(action['slice']) && !rehydratedSlices[action['slice']]) {
                            rehydratedSlices[action['slice']] = true;
                            
                            // Pass the rehydrated state through the original reducer so custom reducers may handle rehydration themselves
                            let rehydratedState: any = originalReducer(undefined, action);
                            if('undefined' === typeof rehydratedState) {
                                rehydratedState = (<Action>action)['payload'];
                            }
                            
                            return Immutable.Iterable.isIterable(state) ?
                                state.set(action['slice'], rehydratedState.get(action['slice']))
                                :
                                (state[action['slice']] = rehydratedState[action['slice']]);
                        }
                        
                        // Ignore rehydration actions for non-existant or already rehydrated slices
                        return state;
                    }
                    
                    return originalReducer(state, action);
                };
                
                originalReplaceReducer(setReducer);
                
                // Execute rehydrations
                if(0 < _.filter(rehydratedSlices, (rehydrated: boolean, slice: string) => true !== rehydrated).length) {
                    rehydrateSlices(rehydratedSlices);
                }
            };
            
            // Replace the originally passed in reducer by the wrapped one
            store.replaceReducer(reducer);
            
            // Hook into dispatch to buffer actions until rehydrated
            const dispatch: (...args: any[]) => any = store.dispatch;
            store.dispatch                          = (...args: any[]): any => {
                // Check if there's a rehydration going on and buffer actions until it's finished
                if(0 < _.filter(rehydratedSlices, (rehydrated: boolean, slice: string) => !rehydrated).length) {
                    // Whenever a rehydration finished, dispatch it
                    if('object' === typeof args[0] && (<Object>args[0]).hasOwnProperty('type') && constants.REHYDRATED_SLICE_ACTION === args[0].type) {
                        dispatch(...args);
                        
                        // ...and flush the action buffer as soon as the last rehydration finished
                        if(0 === _.filter(rehydratedSlices, (rehydrated: boolean, slice: string) => !rehydrated).length) {
                            actionBuffer.forEach((params: any[]) => {
                                dispatch(...params);
                            });
                        }
                        
                        return;
                    }
                    
                    // ...otherwise buffer the action
                    actionBuffer.push(args);
                    
                    return;
                }
                
                // No current rehydration, passthrough to original dispatch
                
                return dispatch(...args);
            };
            
            // Subscribe to store to persist state changes for all slices that have been rehydrated
            store.subscribe(() => {
                const state = store.getState();
                
                try {
                    Object.keys(rehydratedSlices).forEach((slice: string): void => {
                        if(rehydratedSlices[slice]) {
                            configuration.storage.setItem(
                                configuration.storageKey + '@' + slice,
                                Immutable.Iterable.isIterable(state) ?
                                    state.filter((value: any, key: string): boolean => key === slice)
                                    :
                                    pickBy(state, (value: any, key: string): boolean => key === slice)
                            );
                        }
                    });
                }
                catch(error) {
                    console.warn('Unable to persist state to storage:', error);
                }
            });
            
            // Dispatch loaded action so everyone knows that the store is loaded / configured
            store.dispatch(<Action>{type: constants.LOADED_ACTION});
            
            return store;
        };
    };
};