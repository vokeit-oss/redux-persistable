/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { AbstractStorage } from './abstract-storage';
import {
    MigrationType,
    SerializerType,
    StorageType,
    TransformType
} from '../types/index';


export class AbstractBrowserStorage extends AbstractStorage {
    protected storage: StorageType;
    protected serializer: SerializerType;
    
    
    constructor(storageType: 'local' | 'session', serializer?: SerializerType, transforms?: TransformType[], migrations?: MigrationType[]) {
        super(AbstractBrowserStorage.getStorage(<'localStorage' | 'sessionStorage'>(storageType + 'Storage')), serializer, transforms, migrations);
    }
    
    
    /**
     * Check if a given storage is supported
     */
    protected static hasStorage(storageType: 'localStorage' | 'sessionStorage') {
        if('object' !== typeof window || !(storageType in window)) {
            return false;
        }
        
        try {
            let storage   = window[storageType];
            const testKey = `redux-persistable ${storageType} test`;
            
            storage.setItem(testKey, 'test');
            storage.getItem(testKey);
            storage.removeItem(testKey);
        }
        catch(error) {
            if(process.env.NODE_ENV !== 'production') {
                console.warn(`redux-persistable ${storageType} test failed, persistence will be disabled.`);
            }
            
            return false;
        }
        
        return true;
    }
    
    
    /**
     * Get an instance of the given storage or a noop-storage if the given is not supported
     */
    protected static getStorage(storageType: 'localStorage' | 'sessionStorage'): StorageType {
        if(AbstractBrowserStorage.hasStorage(storageType)) {
            const storage: Storage = window[storageType];
            
            return <StorageType>{
                getItem:    (key: string) => new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
                    resolve(storage.getItem(key));
                }),
                setItem:    (key: string, state: any) => new Promise<void>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
                    resolve(storage.setItem(key, state));
                }),
                removeItem: (key: string) => new Promise<void>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
                    resolve(storage.removeItem(key));
                })
            };
        }
        else {
            if(process.env.NODE_ENV !== 'production') {
                console.error('redux-persistable failed to create storage, falling back to memory storage.');
            }
            
            return <StorageType>{
                getItem:    (key: string) => new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
                    resolve(undefined);
                }),
                setItem:    (key: string, state: any) => new Promise<void>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
                    resolve();
                }),
                removeItem: (key: string) => new Promise<void>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
                    resolve();
                })
            };
        }
    }
}