/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import {
    Map,
    OrderedMap,
    Record
} from 'immutable';


export type StateType = Map<string, any> | OrderedMap<string, any> | Record<any>;


export function immutableMerger(initialState: StateType, persistedState: StateType): StateType {
    return persistedState && initialState ? (<Map<string, any> | OrderedMap<string, any> | any>initialState).mergeDeep(persistedState) : initialState;
};