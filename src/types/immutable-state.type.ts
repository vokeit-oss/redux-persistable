/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import {
    Map,
    OrderedMap,
    Record
} from 'immutable';


export type ImmutableStateType = Map<string, any> | OrderedMap<string, any> | Record<any>;
