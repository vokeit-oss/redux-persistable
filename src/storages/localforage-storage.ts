/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import * as localforage from 'localforage';
import { AbstractStorage } from './abstract-storage';
import {
    MigrationType,
    SerializerType,
    TransformType
} from '../types/index';


export class LocalforageStorage extends AbstractStorage {
    constructor(options?: {[key: string]: any}, serializer?: SerializerType, transforms?: TransformType[], migrations?: MigrationType[]) {
        super(
            <any>localforage.createInstance({
                description: '',
                name:        'redux-persistable-application',
                storeName:   'redux-persistable-store',
                ...options
            }),
            serializer,
            transforms,
            migrations
        );
    }
}