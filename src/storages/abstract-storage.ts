/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import * as Immutable from 'immutable';
import { SimpleSerializer } from '../serializers/index';
import {
    MergerType,
    SerializerType,
    StorageType,
    TransformType
} from '../types/index';


export class AbstractStorage {
    protected storage: StorageType;
    protected serializer: SerializerType;
    protected transforms: TransformType[] = [];
    
    
    constructor(storage: StorageType, serializer?: SerializerType, transforms?: TransformType[]) {
        this.storage    = storage;
        this.serializer = 'undefined' !== typeof serializer ? serializer : new SimpleSerializer();
        this.transforms = 'undefined' !== typeof transforms ? transforms : [];
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
        this.transforms = Array.isArray(transforms) ? transforms : [];
    }
    
    
    /**
     * Get an item from storage
     */
    public getItem(key: string): Promise<any> {
        return new Promise<any>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            this.storage.getItem(key).then((serialized: string) => {
                resolve(this.transforms.reduceRight(
                    (previousState: any, transformer: TransformType): any => {
                        const isImmutable: boolean = Immutable.Iterable.isIterable(previousState);
                        
                        if(isImmutable) {
                            previousState.forEach((partialValue: any, partialKey: string) => {
                                previousState = previousState.set(partialKey, transformer.out(previousState.get(partialKey), partialKey));
                            });
                        }
                        else if('object' === typeof previousState && !Array.isArray(previousState) && null !== previousState) {
                            previousState.forEach((partialValue: any, partialKey: string) => {
                                previousState[partialKey] = transformer.out(previousState[partialKey], partialKey);
                            });
                        }
                        
                        return previousState;
                    },
                    this.serializer.parse(serialized)
                ));
            });
        });
    }
    
    
    /**
     * Set an item on storage
     */
    public setItem(key: string, state: any): Promise<void> {
        return new Promise<void>((resolve: (...args: any[]) => void, reject: (...args: any[]) => void) => {
            const endState: any = this.transforms.reduce(
                (previousState: any, transformer: TransformType): any => {
                    const isImmutable: boolean = Immutable.Iterable.isIterable(previousState);
                    
                    if(isImmutable) {
                        previousState.forEach((partialValue: any, partialKey: string) => {
                            previousState = previousState.set(partialKey, transformer.in(previousState.get(partialKey), partialKey));
                        });
                    }
                    else if('object' === typeof previousState && !Array.isArray(previousState) && null !== previousState) {
                        previousState.forEach((partialValue: any, partialKey: string) => {
                            previousState[partialKey] = transformer.in(previousState[partialKey], partialKey);
                        });
                    }
                    
                    return previousState;
                },
                state
            );
            
            'undefined' !== typeof endState ? this.storage.setItem(key, this.serializer.serialize(endState)).then(resolve) : this.removeItem(key).then(resolve);
        });
    }
    
    
    /**
     * Remove an item from storage
     */
    public removeItem(key: string): Promise<void> {
        return this.storage.removeItem(key);
    }
}