/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { ImmutableStateType } from '../types/index';
import { StateType } from '../types/index';


export function immutableMerger(initialState: StateType, persistedState: StateType): StateType {
    return persistedState && initialState ? (<ImmutableStateType>initialState).mergeDeep(persistedState) : initialState;
}
