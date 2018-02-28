/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import {
    Map,
    OrderedMap,
    Record
} from 'immutable';


export type StateType = Map<string, any> | OrderedMap<string, any> | Record<any> | {[key: string]: any};