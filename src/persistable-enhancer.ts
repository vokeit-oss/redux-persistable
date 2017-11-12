/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import * as Immutable from 'immutable';
const filter = require('lodash.filter');
const isMatch = require('lodash.ismatch');
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
import * as constants from './constants';


export default function persistableEnhancer(options: OptionsType): StoreEnhancer<any> {
    const isIterable: Function       = Immutable.Iterable.isIterable;
    const configuration: OptionsType = <OptionsType>{
        merger:     merger,
        storageKey: 'redux-persistable',
        version:    0,
        ...options
    };
    
    if('object' !== typeof configuration.storage) {
        throw new Error('Expected enhancer option "storage" to be an object.');
    }
    else if('function' !== typeof configuration.storage.getItem || 'function' !== typeof configuration.storage.setItem || 'function' !== typeof configuration.storage.removeItem) {
        throw new Error('Expected enhancer option "storage" to be an object with functions "getItem", "setItem" and "removeItem".');
    }
    
    const getShapeAction: string                                                                = '@@redux-persistable/GET_SHAPE_' + Math.random().toString(36).substring(7).split('').join('.');
    const rehydratedSlices: {[key: string]: {status: 'added' | 'pending' | 'done', value: any}} = {};
    const actionBuffers: {[key: string]: any[]}                                                 = {};
    
    return (nextCreateStore: StoreCreator): StoreEnhancerStoreCreator<any> => {
        return (reducer: Reducer<any>, initialState: any, enhancer?: StoreEnhancer<any>): Store<any> => {
            if('function' === typeof initialState && 'undefined' === typeof enhancer) {
                enhancer     = initialState;
                initialState = undefined;
            }
            
            const rehydrateSlices: (currentStore: Store<any>) => void = (currentStore: Store<any>): void => {
                try {
                    Object.keys(rehydratedSlices)
                        .filter((slice: string): boolean => 'added' === rehydratedSlices[slice].status)
                        .forEach((slice: string): void => {
                            rehydratedSlices[slice].status = 'pending';
                            
                            configuration.storage.getItem(configuration.storageKey + '@' + slice).then((persistedState: any) => {
                                const currentState: any    = currentStore.getState();
                                const isImmutable: boolean = isIterable(currentState);
                                const rehydratedState: any = configuration.merger(
                                    isImmutable ? currentState.get(slice) : currentState[slice],
                                    isImmutable ? persistedState.get(slice) : persistedState[slice]
                                );
                                
                                setTimeout(() => currentStore.dispatch(<Action>{type: constants.REHYDRATE_SLICE_ACTION, slice: slice, payload: rehydratedState}), 0);
                            });
                    });
                }
                catch(error) {
                    console.warn('Failed to retrieve persisted state from storage:', error);
                }
            };
            
            // Create store
            const store: Store<any> = nextCreateStore(reducer, initialState, enhancer);
            
            // Hook into dispatch to buffer actions until rehydrated
            const dispatch: (action: Action) => any = store.dispatch;
            store.dispatch                          = (action: Action): any => {
                const actionType: string  = 'type' in action ? action.type : undefined;
                const actionSlice: string = 'slice' in action && 'string' === typeof action['slice'] && 0 < action['slice'].length ? action['slice'] : null;
                
                // Create an action buffer if not done yet
                if(null !== actionSlice && (!(actionSlice in actionBuffers) || !Array.isArray(actionBuffers[actionSlice]))) {
                    actionBuffers[actionSlice] = [];
                }
                
                // Buffer actions for slices that have not yet been rehydrated, skipping those that don't have a "slice" property
                if(constants.REHYDRATE_SLICE_ACTION !== actionType && constants.REHYDRATED_SLICE_ACTION !== actionType &&
                  null !== actionSlice && (!(actionSlice in rehydratedSlices) || 'done' !== rehydratedSlices[actionSlice].status)) {
                    actionBuffers[actionSlice].push(action);
                    
                    return;
                }
                
                // Whenever a rehydration finished, dispatch it and flush the action buffer
                if(constants.REHYDRATED_SLICE_ACTION === actionType) {
                    dispatch(action);
                    
                    actionBuffers[actionSlice] = actionBuffers[actionSlice].filter((bufferedAction: Action): boolean => {
                        dispatch(bufferedAction);
                        
                        return false;
                    });
                    
                    return;
                }
                
                // No current rehydration and no action on a not-yet rehydrated slice - passthrough to original dispatch
                
                return dispatch(action);
            };
            
            // Wrap reducer to catch rehydrate action
            const originalReplaceReducer: (setReducer: Reducer<any>) => void = store.replaceReducer;
            store.replaceReducer                                             = (setReducer: Reducer<any>): void => {
                // Get the shape of the state to know which rehydrations have to be executed
                const currentState: any = setReducer(undefined, <Action>{type: getShapeAction});
                
                if(isIterable(currentState)) {
                    currentState.forEach((value: any, key: string): void => {
                        rehydratedSlices[key] = !(key in rehydratedSlices) ? {status: 'added', value: null} : rehydratedSlices[key];
                    });
                }
                else if('object' === typeof currentState && !Array.isArray(currentState)) {
                    Object.keys(currentState).forEach((key: string): void => {
                        rehydratedSlices[key] = !(key in rehydratedSlices) ? {status: 'added', value: null} : rehydratedSlices[key];
                    });
                }
                
                const originalReducer: Reducer<any> = setReducer;
                setReducer                          = (state: any, action: Action): any => {
                    if(constants.REHYDRATE_SLICE_ACTION === action.type) {
                        if((action['slice'] in rehydratedSlices) && 'pending' === rehydratedSlices[action['slice']].status) {
                            rehydratedSlices[action['slice']].status = 'done';
                            
                            // Pass the rehydrated state through the original reducer so custom reducers may handle rehydration themselves
                            const initialState: any    = originalReducer(undefined, <Action>{type: getShapeAction});
                            const rehydratedState: any = originalReducer(undefined, action);
                            const initialSlice: any    = isIterable(initialState) ? initialState.get(action['slice']) : initialState[action['slice']];
                            let rehydratedSlice: any   = isIterable(initialState) ? rehydratedState.get(action['slice']) : rehydratedState[action['slice']];
                            
                            // If initial state matches the rehydrated state returned from the reducer (no custom rehydration applied) use the state loaded from storage 
                            if(isMatch(isIterable(initialSlice) ? initialSlice.toJS() : initialSlice, isIterable(rehydratedSlice) ? rehydratedSlice.toJS() : rehydratedSlice)) {
                                rehydratedSlice = action['payload'];
                            }
                            
                            // Dispatch an action that the slice has been rehydrated, delayed a bit so dispatch won't complain about a reducer dispatching an action
                            setTimeout(() => store.dispatch(<Action>{
                                type:    constants.REHYDRATED_SLICE_ACTION,
                                slice:   action['slice'],
                                payload: rehydratedSlice
                            }), 0);
                            
                            rehydratedSlices[action['slice']].value = isIterable(state) ? state.set(action['slice'], rehydratedSlice) : {...state, [action['slice']]: rehydratedSlice};
                            
                            return rehydratedSlices[action['slice']].value;
                        }
                        else if((action['slice'] in rehydratedSlices) && 'done' === rehydratedSlices[action['slice']].status) {
                            rehydratedSlices[action['slice']].value = isIterable(state) ? state.set(action['slice'], action['payload']) : {...state, [action['slice']]: action['payload']};
                            
                            return rehydratedSlices[action['slice']].value;
                        }
                        
                        // Ignore rehydration actions for non-existant or slices that are neither pending nor done
                        return state;
                    }
                    
                    return originalReducer(state, action);
                };
                
                originalReplaceReducer(setReducer);
                
                // Execute rehydrations
                if(0 < filter(rehydratedSlices, (rehydrated: {status: 'added' | 'pending' | 'done', value: any}, slice: string) => 'added' === rehydrated.status).length) {
                    setTimeout((): void => rehydrateSlices(store), 0);
                }
            };
            
            // Replace the originally passed in reducer by the wrapped one
            store.replaceReducer(reducer);
            
            // Subscribe to store to persist state changes for all slices that have been rehydrated
            store.subscribe(() => {
                const state = store.getState();
                
                try {
                    Object.keys(rehydratedSlices).forEach((slice: string): void => {
                        if('done' === rehydratedSlices[slice].status) {
                            configuration.storage.setItem(
                                configuration.storageKey + '@' + slice,
                                isIterable(state) ? state.filter((value: any, key: string): boolean => key === slice) : pickBy(state, (value: any, key: string): boolean => key === slice),
                                configuration.version
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