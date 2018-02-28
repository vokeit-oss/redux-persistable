/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { StateType } from '../types/index';


export default function merger(initialState: StateType, persistedState: StateType): StateType {
    return persistedState ? {...initialState, ...persistedState} : initialState;
};
