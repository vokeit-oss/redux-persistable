/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


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
    
    const rehydrateAction: string = '@@redux-persistable/REHYDRATE_' + Math.random().toString(36).substring(7).split('').join('.');
    let rehydrated: boolean       = false;
    const actionBuffer: any[]     = [];
    
    return (nextCreateStore: StoreCreator): StoreEnhancerStoreCreator<any> => {
        return (reducer: Reducer<any>, initialState: any, enhancer?: StoreEnhancer<any>): Store<any> => {
            if('function' === typeof initialState && 'undefined' === typeof enhancer) {
                enhancer     = initialState;
                initialState = undefined;
            }
            
            // Create store
            const store: Store<any> = nextCreateStore(reducer, initialState, enhancer);
            
            // Wrap reducer to catch rehydrate action
            const originalReplaceReducer: (setReducer: Reducer<any>) => void = store.replaceReducer;
            store.replaceReducer                                          = (setReducer: Reducer<any>): void => {
                const originalReducer: Reducer<any> = setReducer;
                setReducer                          = (state: any, action: Action): any => {
                    if(!rehydrated && rehydrateAction === action.type) {
                        rehydrated = true;
                        
                        return (<any>action)['payload'];
                    }
                    
                    return originalReducer(state, action);
                };
                
                originalReplaceReducer(setReducer);
            };
            
            store.replaceReducer(reducer);
            
            // Hook into dispatch to buffer actions until rehydrated
            const dispatch: (...args: any[]) => any = store.dispatch;
            store.dispatch                          = (...args: any[]): any => {
                if(!rehydrated) {
                    // When rehydration occurs, dispatch it and flush the action buffer
                    if('object' === typeof args[0] && (<Object>args[0]).hasOwnProperty('type') && rehydrateAction === args[0].type) {
                        dispatch(...args);
                        
                        actionBuffer.forEach((params: any[]) => {
                            dispatch(...params);
                        });
                        
                        return;
                    }
                    
                    // ...otherwise buffer the action
                    actionBuffer.push(args);
                    
                    return;
                }
                
                // Already rehydrated, passthrough to original dispatch
                
                return dispatch(...args);
            };
            
            // Rehydrate state as soon as persisted state is available
            try {
                configuration.storage.getItem(configuration.storageKey).then((persistedState: any) => {
                    const currentState: any    = store.getState();
                    const rehydratedState: any = configuration.merger(currentState, persistedState);
                    
                    store.dispatch(<Action>{type: rehydrateAction, payload: rehydratedState});
                });
            }
            catch(error) {
                console.warn('Failed to retrieve persisted state from storage:', error);
            }
            
            // Subscribe to store to persist state changes
            store.subscribe(() => {
                const state = store.getState();
                
                try {
                    configuration.storage.setItem(configuration.storageKey, state);
                }
                catch(error) {
                    console.warn('Unable to persist state to storage:', error);
                }
            });
            
            return store;
        };
    };
};