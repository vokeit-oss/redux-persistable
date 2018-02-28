/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import { AbstractBrowserStorage } from './abstract-browser-storage';
import {
    MigrationType,
    SerializerType,
    TransformType
} from '../types/index';


export class SessionstorageStorage extends AbstractBrowserStorage {
    constructor(serializer?: SerializerType, transforms?: TransformType[], migrations?: MigrationType[]) {
        super('session', serializer, transforms, migrations);
    }
}