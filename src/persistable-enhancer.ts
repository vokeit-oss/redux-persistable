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
    const rehydratedSlices: {[key: string]: {status: 'added' | 'pending' | 'processing' | 'done', value: any}} = {};
    const actionBuffers: {[key: string]: any[]}                                                 = {};
    
    return (nextCreateStore: StoreCreator): StoreEnhancerStoreCreator<any> => {
        return (reducer: Reducer<any>, initialState: any, enhancer?: StoreEnhancer<any>): Store<any> => {
            if('function' === typeof initialState && 'undefined' === typeof enhancer) {
                enhancer     = initialState;
                initialState = undefined;
            }
            
            const rehydrateSlices: (currentStore: Store<any>, newReducer: Reducer<any>) => void = (currentStore: Store<any>, newReducer: Reducer<any>): void => {
                try {
                    Object.keys(rehydratedSlices)
                        .filter((slice: string): boolean => 'added' === rehydratedSlices[slice].status)
                        .forEach((slice: string): void => {
                            rehydratedSlices[slice].status = 'pending';
                            
                            // Load from storage
                            configuration.storage.getItem(configuration.storageKey + '@' + slice).then((persistedState: any) => {
                                const currentState: any    = currentStore.getState();
                                const isImmutable: boolean = isIterable(currentState);
                                const loadedState: any     = configuration.merger(
                                    isImmutable ? currentState.get(slice) : currentState[slice],
                                    isImmutable ? persistedState.get(slice) : persistedState[slice]
                                );
                                
                                // Pass the loaded state through the original reducer so custom reducers may handle rehydration themselves
                                const rehydratedState: any = newReducer(undefined, <Action>{type: constants.REHYDRATE_SLICE_ACTION, slice: slice, payload: loadedState});
                                const initialSlice: any    = isImmutable ? currentState.get(slice) : currentState[slice];
                                let rehydratedSlice: any   = isImmutable ? rehydratedState.get(slice) : rehydratedState[slice];
                                
                                // If initial state matches the rehydrated state returned from the reducer (no custom rehydration applied) use the state loaded from storage 
                                if(isMatch(isIterable(initialSlice) ? initialSlice.toJS() : initialSlice, isIterable(rehydratedSlice) ? rehydratedSlice.toJS() : rehydratedSlice)) {
                                    rehydratedSlice = loadedState;
                                }
                                
                                rehydratedSlices[slice].value  = isImmutable ? rehydratedSlice : rehydratedSlice;
                                rehydratedSlices[slice].status = 'processing';
                                
                                // Dispatch an action that the slice has been rehydrated
                                store.dispatch(<Action>{
                                    type:    constants.REHYDRATED_SLICE_ACTION,
                                    slice:   slice,
                                    payload: rehydratedSlice
                                });
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
            const originalDispatch: (action: Action) => any = store.dispatch;
            store.dispatch                                  = (action: Action): any => {
                const actionType: string  = 'type' in action ? action.type : undefined;
                const actionSlice: string = 'slice' in action && 'string' === typeof action['slice'] && 0 < action['slice'].length ? action['slice'] : null;
                
                // No slice, no to-rehydrate-slice or already rehydrated - no need to process
                if(null === actionSlice || !(actionSlice in rehydratedSlices) || ((actionSlice in rehydratedSlices) && 'done' === rehydratedSlices[actionSlice].status)) {
                    return originalDispatch(action);
                }
                
                // Create an action buffer for the slice if not done yet
                if((!(actionSlice in actionBuffers) || !Array.isArray(actionBuffers[actionSlice]))) {
                    actionBuffers[actionSlice] = [];
                }
                
                // Buffer actions for slices that have not yet been rehydrated
                if(constants.REHYDRATE_SLICE_ACTION !== actionType && constants.REHYDRATED_SLICE_ACTION !== actionType) {
                    actionBuffers[actionSlice].push(action);
                    
                    return;
                }
                
                // Whenever a rehydration finished, dispatch it and flush the action buffer
                if(constants.REHYDRATED_SLICE_ACTION === actionType && 'processing' === rehydratedSlices[actionSlice].status) {
                    originalDispatch(action);
                    
                    actionBuffers[actionSlice] = actionBuffers[actionSlice].filter((bufferedAction: Action): boolean => {
                        originalDispatch(bufferedAction);
                        
                        return false;
                    });
                    
                    // Set the status to "done" so buffering is disabled from now on
                    rehydratedSlices[actionSlice].status = 'done';
                    
                    return;
                }
                
                // No current rehydration and no action on a not-yet rehydrated slice - passthrough to original dispatch
                
                return originalDispatch(action);
            };
            
            // Wrap reducer to catch rehydrate action
            const originalReplaceReducer: (newReducer: Reducer<any>) => void = store.replaceReducer;
            store.replaceReducer                                             = (newReducer: Reducer<any>): void => {
                // Get the shape of the state to know which rehydrations have to be executed
                const currentState: any = newReducer(undefined, <Action>{type: getShapeAction});
                
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
                
                const originalReducer: Reducer<any> = newReducer;
                newReducer                          = (state: any, action: Action): any => {
                    if(constants.REHYDRATED_SLICE_ACTION === action.type && ('slice' in action) && (action['slice'] in rehydratedSlices) && 'processing' === rehydratedSlices[action['slice']].status) {
                        return originalReducer(isIterable(state) ? state.set(action['slice'], action['payload']) : {...state, [action['slice']]: action['payload']}, action);
                    }
                    
                    return originalReducer(state, action);
                };
                
                originalReplaceReducer(newReducer);
                
                // Execute rehydrations
                if(0 < filter(rehydratedSlices, (rehydrated: {status: 'added' | 'pending' | 'processing' | 'done', value: any}, slice: string) => 'added' === rehydrated.status).length) {
                    setTimeout((): void => rehydrateSlices(store, newReducer), 0);
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
                    console.warn('Failed to persist state to storage:', error);
                }
            });
            
            // Dispatch loaded action so everyone knows that the store is loaded / configured
            store.dispatch(<Action>{type: constants.LOADED_ACTION});
            
            return store;
        };
    };
};