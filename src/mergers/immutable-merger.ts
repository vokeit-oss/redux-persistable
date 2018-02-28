/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { ImmutableStateType } from '../types/index';


export function immutableMerger(initialState: ImmutableStateType, persistedState: ImmutableStateType): ImmutableStateType {
    return persistedState && initialState ? initialState.mergeDeep(persistedState) : initialState;
};
