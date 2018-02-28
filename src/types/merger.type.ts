/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { StateType } from './state.type';


export type MergerType = (initialState: StateType, persistedState: StateType) => StateType;
