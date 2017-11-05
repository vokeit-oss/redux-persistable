/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import * as Immutable from 'immutable';


export default function immutableMerger(
                            initialState: Immutable.List<any> | Immutable.Map<any, any> | Immutable.OrderedMap<any, any>,
                            persistedState: Immutable.List<any> | Immutable.Map<any, any> | Immutable.OrderedMap<any, any>
                        ): Immutable.List<any> | Immutable.Map<any, any> | Immutable.OrderedMap<any, any> {
    return persistedState ? (<any>initialState).mergeDeep(persistedState) : initialState;
};