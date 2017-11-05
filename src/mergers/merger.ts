/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export default function merger(initialState: any, persistedState: any): any {
    return persistedState ? {...initialState, ...persistedState} : initialState;
};