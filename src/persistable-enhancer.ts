/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import {
    isImmutable,
    Map,
    OrderedMap,
    Record
} from 'immutable';
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


import * as constants from './constants';
import { merger } from './mergers/index';
import {
    ActionBufferType,
    ImmutableStateType,
    OptionsType,
    StateType
} from './types/index';


// Internal actions that should not be catched by reducers
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


    /**
     * Get a value independent of state type (immutable / plain JavaScript object)
     *
     * @param {StateType} state
     * @param {string} key
     * @returns {any}
     */
    function getValue(state: StateType, key: string): any {
        return isImmutable(state) ? state.get(key) : state[key];
    }
    

    /**
     * Set a value independent of state type (immutable / plain JavaScript object)
     *
     * @param {StateType} state
     * @param {string} key
     * @param value
     * @returns {StateType}
     */
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


    /**
     * Create the store and override several methods
     *
     * @param {StoreCreator} nextCreateStore
     * @param {Reducer<StateType>} reducer
     * @param {StateType} initialState
     * @param {StoreEnhancer<StateType>} enhancer
     */
    function createStore(nextCreateStore: StoreCreator, reducer: Reducer<StateType>, initialState: StateType, enhancer?: StoreEnhancer<StateType>): void {
        store = nextCreateStore(reducer, initialState, enhancer);

        // Override dispatch method to catch several actions
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
                });
            }
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

        // Override replaceReducer to catch newly added reducers
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

                    return 'undefined' !== typeof buffer.data &&
                           isMatch(isImmutable(previousSliceState) ? previousSliceState.toJS() : previousSliceState, isImmutable(nextSliceState) ? nextSliceState.toJS() : nextSliceState) ?
                        setValue(state, buffer.slice, buffer.data) : nextState;
                }
                
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


    /**
     * Flush the given action buffer
     * Waits for prior buffers to complete and flushes subsequent buffers that are already completed
     *
     * @param {number} currentBuffer
     */
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


    /**
     * Analyze the reducer tree to identify slices
     *
     * @param {Reducer<any>} reducer
     */
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


    /**
     * Dispatch rehydrate actions for all slices that were added
     */
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

            // Subscribe to store to persist state changes for all slices that have been rehydrated
            store.subscribe(() => {
                const state: any = store.getState();

                try {
                    Object.keys(slices).forEach((slice: string): void => {
                        if('done' === slices[slice]) {
                            configuration.storage.setItem(
                                configuration.storageKey + '@' + slice,
                                isImmutable(state) ? (<ImmutableStateType | any>state).filter((value: any, key: string): boolean => key === slice) : pickBy(state, (value: any, key: string): boolean => key === slice),
                                configuration.version
                            ).then();
                        }
                    });
                }
                catch(error) {
                    console.warn('Failed to persist state to storage:', error);
                }
            });
            
            return store;
        };
    };
};
