/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import {
    isImmutable,
    Map,
    OrderedMap
} from 'immutable';
import { SimpleSerializer } from '../serializers/index';
import {
    MigrationType,
    SerializerType,
    StorageType,
    TransformType
} from '../types/index';


export class AbstractStorage {
    protected storage: StorageType;
    protected serializer: SerializerType;
    protected transforms: TransformType[]           = [];
    protected migrations: {[key: number]: Function} = {};
    
    
    constructor(storage: StorageType, serializer?: SerializerType, transforms?: TransformType[], migrations?: MigrationType[]) {
        this.storage = storage;
        
        this.setSerializer('undefined' !== typeof serializer ? serializer : new SimpleSerializer());
        this.setTransforms(transforms);
        this.setMigrations(migrations);
    }
    
    
    /**
     * Set serializer
     */
    public setSerializer(serializer: SerializerType): void {
        this.serializer = serializer;
    }
    
    
    /**
     * Set transforms
     */
    public setTransforms(transforms?: TransformType[]): void {
        this.transforms = Array.isArray(transforms) ?
            transforms.filter((transform: any): boolean => {
                return 'object' === typeof transform && 'function' === typeof transform.transformDataToStorage && 'function' === typeof transform.transformDataFromStorage;
            })
            :
            [];
    }
    
    
    /**
     * Set migrations
     */
    public setMigrations(migrations?: MigrationType[]): void {
        migrations = Array.isArray(migrations) ?
            migrations.filter((migration: any): boolean => {
                return 'object' === typeof migration && 'number' === typeof migration.version && 'function' === typeof migration.migration;
            })
            :
            [];
        
        this.migrations = {};
        
        migrations.forEach((migration: MigrationType): void => {
            this.migrations[migration.version] = migration.migration;
        });
    }
    
    
    /**
     * Get an item from storage
     */
    public getItem(key: string): Promise<any> {
        return new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            this.storage.getItem(key).then((serialized: string) => {
                resolve(this.transforms.reduceRight(
                    (previousState: any, transformer: TransformType): any => {
                        if(isImmutable(previousState)) {
                            previousState.forEach((partialValue: any, partialKey: string) => {
                                previousState = previousState.set(partialKey, transformer.transformDataFromStorage(previousState.get(partialKey), partialKey));
                            });
                        }
                        else if('object' === typeof previousState && !Array.isArray(previousState) && null !== previousState) {
                            previousState.forEach((partialValue: any, partialKey: string) => {
                                previousState[partialKey] = transformer.transformDataFromStorage(previousState[partialKey], partialKey);
                            });
                        }
                        
                        return previousState;
                    },
                    this.migrate(this.serializer.parse(serialized), key)
                ));
            });
        });
    }
    
    
    /**
     * Set an item on storage
     */
    public setItem(key: string, state: any, version?: number): Promise<void> {
        return new Promise<void>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            let endState: any = this.transforms.reduce(
                (previousState: any, transformer: TransformType): any => {
                    if(isImmutable(previousState)) {
                        previousState.forEach((partialValue: any, partialKey: string) => {
                            previousState = previousState.set(partialKey, transformer.transformDataToStorage(previousState.get(partialKey), partialKey));
                        });
                    }
                    else if('object' === typeof previousState && !Array.isArray(previousState) && null !== previousState) {
                        previousState.forEach((partialValue: any, partialKey: string) => {
                            previousState[partialKey] = transformer.transformDataToStorage(previousState[partialKey], partialKey);
                        });
                    }
                    
                    return previousState;
                },
                state
            );
            
            const persistable: {[key: string]: any} = {version: 'number' === typeof version ? version : null};
            
            isImmutable(endState) ?
                (endState = (<Map<string, any> | OrderedMap<string, any> | any>endState).set('@@__redux-persistable__', persistable))
                :
                (endState['@@__redux-persistable__'] = persistable);
            
            'undefined' !== typeof endState ? this.storage.setItem(key, this.serializer.serialize(endState)).then(resolve) : this.removeItem(key).then(resolve);
        });
    }
    
    
    /**
     * Remove an item from storage
     */
    public removeItem(key: string): Promise<void> {
        return this.storage.removeItem(key);
    }
    
    
    /**
     * Migrate de-serialized data before it get's passed to transforms
     */
    protected migrate(deserialized: any, key: string): any {
        const versions: number[] = Object.keys(this.migrations).map((version: string): number => Number(version)).sort((a: number, b: number): number => a > b ? 1 : a < b ? -1 : 0);
        
        // No migrations available - return early
        if(0 === versions.length) {
            return deserialized;
        }
        
        let currentVersion: number;
        
        if('object' === deserialized && '@@__redux-persistable__' in deserialized) {
            const persistable: {[key: string]: any} = deserialized['@@__redux-persistable__'];
            
            if('version' in persistable) {
                currentVersion = Number(persistable.version);
            }
        }
        
        // Found version is equivalent or greater than the latest migration version - skip migrations
        if('number' === typeof currentVersion && currentVersion >= versions[versions.length]) {
            return deserialized;
        }
        
        // Filter migrations to apply
        const migrationVersions: number[] = 'number' !== typeof currentVersion ? versions : versions.filter((version: number): boolean => version > currentVersion);
        let migrated: any                 = deserialized;
        
        // Step through all required migrations, the next migration receives the result of the previous migration and the corresponding version as parameters 
        migrationVersions.forEach((nextVersion: number): void => {
            let {state, version}: {state: any, version: number} = this.migrations[nextVersion](migrated, currentVersion);
            migrated                                            = state;
            currentVersion                                      = version;
        });
        
        return migrated;
    }
}