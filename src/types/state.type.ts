/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { ImmutableStateType } from './immutable-state.type';


export type StateType = ImmutableStateType | {[key: string]: any};
