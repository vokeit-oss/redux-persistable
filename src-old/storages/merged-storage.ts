/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


const cloneDeep = require('lodash.clonedeep');
import {
    MergerType,
    MigrationType,
    SerializerType,
    StorageType,
    TransformType
} from '../types/index';


export class MergedStorage {
    protected blankState: any;
    protected merger: MergerType;
    protected storages: {[key: string]: StorageType} = {};
    
    
    constructor(blankState: any, merger: MergerType, storages?: {[key: string]: StorageType}) {
        this.blankState = blankState;
        this.merger     = merger;
        
        if('undefined' !== typeof storages) {
            this.setStorages(storages);
        }
    }
    
    
    /**
     * Check if storage with given id exists
     */
    public hasStorage(id: string): boolean {
        return this.storages.hasOwnProperty(id);
    }
    
    
    /**
     * Get storage by given id
     */
    public getStorage(id: string): StorageType {
        return this.hasStorage(id) ? this.storages[id] : null;
    }
    
    
    /**
     * Add storage (throw when existing)
     */
    public addStorage(id: string, storage: StorageType): void {
        if(this.hasStorage(id)) {
            throw new Error(`Storage with id ${id} is already registered.`);
        }
        
        this.storages[id] = storage;
    }
    
    
    /**
     * Add multiple storages
     */
    public addStorages(storages: {[key: string]: StorageType}): void {
        Object.keys(storages).forEach((id: string) => {
            this.addStorage(id, storages[id]);
        });
    }
    
    
    /**
     * Set storage (ignore error when existing)
     */
    public setStorage(id: string, storage: StorageType): void {
        this.storages[id] = storage;
    }
    
    
    /**
     * Set multiple storages
     */
    public setStorages(storages: {[key: string]: StorageType}): void {
        Object.keys(storages).forEach((id: string) => {
            this.setStorage(id, storages[id]);
        });
    }
    
    
    /**
     * Remove storage
     */
    public removeStorage(id: string): void {
        if(this.hasStorage(id)) {
            delete this.storages[id];
        }
    }
    
    
    /**
     * Remove multiple storages
     */
    public removeStorages(ids: string[]): void {
        ids.forEach((id: string) => {
            this.removeStorage(id);
        });
    }
    
    
    /**
     * Remove all storages
     */
    public clearStorages(): void {
        this.storages = {};
    }
    
    
    /**
     * Set serializer / ignored for MergedStorage
     */
    public setSerializer(serializer: SerializerType): void {
    }
    
    
    /**
     * Set transforms / ignored for MergedStorage
     */
    public setTransforms(transforms?: TransformType[]): void {
    }
    
    
    /**
     * Set migrations / ignored for MergedStorage
     */
    public setMigrations(migrations?: MigrationType[]): void {
    }
    
    
    /**
     * Get an item from combined storages
     */
    public getItem(key: string): Promise<any> {
        return new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            const promises: Promise<any>[] = [];
            
            Object.keys(this.storages).forEach((id: string) => {
                promises.push(this.storages[id].getItem(key));
            });
            
            Promise.all(promises).then((partialStates: any[]): void => {
                let state: any = cloneDeep(this.blankState);
                
                partialStates.forEach((partialState: any): void => {
                    if('undefined' !== typeof partialState) {
                        state = 'undefined' === typeof state ? partialState : this.merger(state, partialState);
                    }
                });
                
                resolve(state);
            });
        });
    }
    
    
    /**
     * Set an item on combined storages
     */
    public setItem(key: string, state: any, version?: number): Promise<void> {
        return new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            const promises: Promise<void>[] = [];
            
            Object.keys(this.storages).forEach((id: string) => {
                promises.push(this.storages[id].setItem(key, state, version));
            });
            
            Promise.all(promises).then(resolve);
        });
    }
    
    
    /**
     * Remove an item from combined storages
     */
    public removeItem(key: string): Promise<void> {
        return new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            const promises: Promise<void>[] = [];
            
            Object.keys(this.storages).forEach((id: string) => {
                promises.push(this.storages[id].removeItem(key));
            });
            
            Promise.all(promises).then(resolve);
        });
    }
}