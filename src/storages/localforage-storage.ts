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


export class LocalforageWrapper {
    protected localforage: any;


    constructor(options?: {[key: string]: any}) {
        this.localforage = localforage.createInstance({
            description: '',
            name:        'redux-persistable-application',
            storeName:   'redux-persistable-store',
            ...options
        });
    }


    public getItem(key: string): Promise<any> {
        return this.localforage.getItem(key);
    }


    public setItem(key: string, state: any, version?: number): Promise<void> {
        return this.localforage.setItem(key, state);
    }


    public removeItem(key: string): Promise<void> {
        return this.localforage.removeItem(key);
    }
}


export class LocalforageStorage extends AbstractStorage {
    constructor(options?: {[key: string]: any}, serializer?: SerializerType, transforms?: Array<TransformType>, migrations?: Array<MigrationType>) {
        super(
            new LocalforageWrapper(options),
            serializer,
            transforms,
            migrations
        );
    }
}
