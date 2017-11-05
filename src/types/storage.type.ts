/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { SerializerType } from './serializer.type';
import { TransformType } from './transform.type';


export type StorageType = {
    setSerializer: (serializer: SerializerType) => void,
    setTransforms: (transforms?: TransformType[]) => void,
    getItem:       (key: string) => Promise<any>,
    setItem:       (key: string, state: any) => Promise<void>,
    removeItem:    (key: string) => Promise<void>
};