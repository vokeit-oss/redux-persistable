/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import {
    isImmutable,
    Map,
    OrderedMap,
    Record
} from 'immutable';
import {
    Action,
    Reducer,
    Store,
    StoreCreator,
    StoreEnhancer,
    StoreEnhancerStoreCreator
} from 'redux';


import * as constants from './constants';
import { merger } from './mergers/index';
import {
    ActionBufferType,
    ImmutableStateType,
    OptionsType,
    StateType
} from './types/index';


// Internal actions that should not be catched by reducers
const setStateAction: string = '@@actra-development-oss/redux-persistable/SET_STATE_' + Math.random().toString(36).substring(7).split('').join('.');
const getShapeAction: string = '@@actra-development-oss/redux-persistable/GET_SHAPE_' + Math.random().toString(36).substring(7).split('').join('.');


export default function persistableEnhancer(options: OptionsType): (nextCreateStore: StoreCreator) => StoreEnhancerStoreCreator<StateType> {
    const configuration: OptionsType = <OptionsType>{
        merger:     merger,
        storageKey: 'redux-persistable',
        version:    0,
        ...options
    };
    
    let store: Store<StateType>;
    let actionBuffers: {[key: number]: ActionBufferType}                                     = {};
    let bufferIndex: number                                                                  = -1;
    const slices: {[key: string]: 'added' | 'pending' | 'processing' | 'processed' | 'done'} = {};
    
    
    function getValue(state: StateType, key: string): any {
        return isImmutable(state) ? state.get(key) : state[key];
    }
    
    
    function setValue(state: StateType, key: string, value: any): StateType {
        if(isImmutable(state)) {
            if(!Map.isMap(state) && !OrderedMap.isOrderedMap(state) && !Record.isRecord(state)) {
                throw new Error('redux-persistable can only handle immutable states of type Map, OrderedMap or Record.');
            }

            return (<Map<string, any> | OrderedMap<string, any> | any>state).set(key, value);
        }
        else if('object' === typeof state && !Array.isArray(state) && null !== state) {
            return {...state, [key]: value};
        }
        else {
            throw new Error('redux-persistable can only handle immutable states of type Map, OrderedMap or Record and plain JavaScript objects.');
        }
    }
    
    
    function createStore(nextCreateStore: StoreCreator, reducer: Reducer<StateType>, initialState: StateType, enhancer?: StoreEnhancer<StateType>): void {
        store = nextCreateStore(reducer, initialState, enhancer);
        
        const originalDispatch: (action: Action) => any = store.dispatch;
        const newDispatch: (action: Action) => any      = (action: Action): any => {
            if(constants.REHYDRATE_ACTION === action.type) {
                if(!('slice' in action)) {
                    return originalDispatch(action);
                }
                
                const slice: string = (<Action & {slice: string}>action).slice;
                if('pending' !== slices[slice]) {
                    return;
                }
                
                slices[slice]                = 'processing';
                const currentBuffer: number  = ++bufferIndex;
                actionBuffers[currentBuffer] = {slice: slice, ready: false, actions: [], data: undefined};
                
                configuration.storage.getItem(configuration.storageKey + '@' + slice).then((data: any): void => {
                    actionBuffers[currentBuffer].data = getValue(data, slice);

                    originalDispatch(<Action & {slice: string, buffer: number}>{type: constants.REHYDRATE_ACTION, slice: slice, buffer: currentBuffer});

                    // const previousState: any = getValue(store.getState(), slice);
                    //
                    // originalDispatch(<Action & {payload: any, slice: string}>{type: constants.REHYDRATE_ACTION, payload: getValue(data, slice), slice: slice});
                    //
                    // const nextState: any                    = getValue(store.getState(), slice);
                    // const wasHandled: boolean               = previousState !== nextState;
                    // actionBuffers[currentBuffer].wasHandled = !wasHandled ? getValue(data, slice) : nextState;
                    // actionBuffers[currentBuffer].data       = !wasHandled ? getValue(data, slice) : nextState;
                    //
                    // newDispatch(<Action & {buffer: number}>{type: setStateAction, buffer: currentBuffer});
                });
            }
            // else if(setStateAction === action.type) {
            //     if(!('buffer' in action) || !(actionBuffers[(<Action & {buffer: number}>action).buffer])) {
            //         return;
            //     }
            //
            //     const slice: string = actionBuffers[(<Action & {buffer: number}>action).buffer].slice;
            //     if('processing' !== slices[slice]) {
            //         return;
            //     }
            //
            //     originalDispatch(action);
            //
            //     slices[slice] = 'processed';
            //
            //     newDispatch(<Action & {buffer: number}>{type: constants.REHYDRATED_ACTION, buffer: (<Action & {buffer: number}>action).buffer});
            // }
            else if(constants.REHYDRATED_ACTION === action.type) {
                if(!('buffer' in action) || !(actionBuffers[(<Action & {buffer: number}>action).buffer])) {
                    return;
                }
                
                const slice: string = actionBuffers[(<Action & {buffer: number}>action).buffer].slice;
                if('processed' !== slices[slice]) {
                    return;
                }
                
                slices[slice] = 'done';
                
                originalDispatch(<Action & {slice: string, payload: any}>{type: constants.REHYDRATED_ACTION, slice: slice, payload: actionBuffers[(<Action & {buffer: number}>action).buffer].data});
                flushBuffer((<Action & {buffer: number}>action).buffer);
            }
            else if(Object.keys(actionBuffers).length) {
                actionBuffers[bufferIndex].actions.push(action);
            }
            else {
                originalDispatch(action);
            }
        };
        
        const originalReplaceReducer: (reducer: Reducer<StateType>) => void = store.replaceReducer;
        const newReplaceReducer: (reducer: Reducer<StateType>) => void      = (reducer: Reducer<StateType>): void => {
            const originalReducer: Reducer<StateType> = reducer;
            const newReducer: Reducer<StateType>      = (state: StateType, action: Action): StateType => {
                if(constants.REHYDRATE_ACTION === action.type) {
                    if(!('buffer' in action) || !(actionBuffers[(<Action & {buffer: number}>action).buffer])) {
                        return state;
                    }

                    const buffer: ActionBufferType = actionBuffers[(<Action & {buffer: number}>action).buffer];
                    if('processing' !== slices[buffer.slice]) {
                        return state;
                    }

                    const previousSliceState: any = getValue(state, buffer.slice);
                    const nextState: StateType    = originalReducer(state, action);
                    const nextSliceState: any     = getValue(nextState, buffer.slice);
                    slices[buffer.slice]          = 'processed';

                    setTimeout((): void => newDispatch(<Action & {buffer: number}>{type: constants.REHYDRATED_ACTION, buffer: (<Action & {buffer: number}>action).buffer}), 0);

                    return previousSliceState === nextSliceState ? setValue(state, buffer.slice, buffer.data) : nextState;
                }



                // if(setStateAction === action.type) {
                //     if(!('buffer' in action) || !(actionBuffers[(<Action & {buffer: number}>action).buffer])) {
                //         return state;
                //     }
                //
                //     const buffer: ActionBufferType = actionBuffers[(<Action & {buffer: number}>action).buffer];
                //     if('processing' !== slices[buffer.slice]) {
                //         return state;
                //     }
                //
                //     return setValue(state, buffer.slice, buffer.data);
                // }
                
                return originalReducer(state, action);
            };
            
            // Analyze new reducer tree
            analyzeReducerTree(originalReducer);
            
            // Replace root reducer
            originalReplaceReducer(newReducer);
            
            // Rehydrate
            rehydrate();
        };
        
        store.dispatch       = newDispatch;
        store.replaceReducer = newReplaceReducer;
    }
    
    
    function flushBuffer(currentBuffer: number): void {
        if(currentBuffer in actionBuffers) {
            actionBuffers[currentBuffer].ready = true;

            if(0 === (<Array<string>>Object.keys(actionBuffers)).filter((bufferIndex: string): boolean => { return parseInt(bufferIndex, 10) < currentBuffer; }).length) {
                let action: Action;
                while(!!(action = actionBuffers[currentBuffer].actions.shift())) {
                    store.dispatch(action);
                }

                delete actionBuffers[currentBuffer];

                const bufferKeys: any[]  = Object.keys(actionBuffers);
                const nextBuffer: number = parseInt(bufferKeys.sort().shift(), 10);
                if(!!nextBuffer && actionBuffers[nextBuffer].ready) {
                    flushBuffer(nextBuffer);
                }
            }
        }
    }
    
    
    function analyzeReducerTree(reducer: Reducer<any>): void {
        const state: StateType = reducer(undefined, <Action>{type: getShapeAction});
        
        if(isImmutable(state)) {
            if(!Map.isMap(state) && !OrderedMap.isOrderedMap(state) && !Record.isRecord(state)) {
                throw new Error('redux-persistable can only handle immutable states of type Map, OrderedMap or Record.');
            }

            Object.keys((<ImmutableStateType>state).toJS()).forEach((key: string): void => {
                slices[key] = !(key in slices) ? 'added' : slices[key];
            });
        }
        else if('object' === typeof state && !Array.isArray(state) && null !== state) {
            Object.keys(state).forEach((key: string): void => {
                slices[key] = !(key in slices) ? 'added' : slices[key];
            });
        }
        else if('undefined' === typeof state) {
            return;
        }
        else {
            throw new Error('redux-persistable can only handle immutable states of type Map, OrderedMap or Record and plain JavaScript objects.');
        }
    }
    
    
    function rehydrate(): void {
        const currentSlices: {[key: string]: 'added' | 'pending' | 'processing' | 'processed' | 'done'} = {...slices};
        
        Object.keys(currentSlices)
            .filter((slice: string): boolean => 'added' === currentSlices[slice])
            .forEach((slice: string): void => {
                slices[slice] = 'pending';
                
                store.dispatch(<Action & {slice: string}>{type: constants.REHYDRATE_ACTION, slice: slice});
            });
    }
    
    
    return (nextCreateStore: StoreCreator): StoreEnhancerStoreCreator<any> => {
        return (reducer: Reducer<any>, initialState: any, enhancer?: StoreEnhancer<any>): Store<any> => {
            if('function' === typeof initialState && 'undefined' === typeof enhancer) {
                enhancer     = initialState;
                initialState = undefined;
            }
            
            // Analyze current reducer tree
            analyzeReducerTree(reducer);
            
            // Create store
            createStore(nextCreateStore, reducer, initialState, enhancer);
            
            // Initial rehydration
            rehydrate();
            
            return store;
        };
    };
};
