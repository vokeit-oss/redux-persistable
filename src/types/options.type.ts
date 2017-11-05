/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { MergerType } from './merger.type';
import { StorageType } from './storage.type';


export type OptionsType = {
    merger:     MergerType,
    storage:    StorageType,
    storageKey: string
};