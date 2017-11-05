/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { AbstractBrowserStorage } from './abstract-browser-storage';
import {
    SerializerType,
    TransformType
} from '../types/index';


export class LocalstorageStorage extends AbstractBrowserStorage {
    constructor(serializer?: SerializerType, transforms?: TransformType[]) {
        super('local', serializer, transforms);
    }
}