/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { AbstractBrowserStorage } from './abstract-browser-storage';
import {
    SerializerType,
    TransformType
} from '../types/index';


export class SessionstorageStorage extends AbstractBrowserStorage {
    constructor(serializer?: SerializerType, transforms?: TransformType[]) {
        super('session', serializer, transforms);
    }
}