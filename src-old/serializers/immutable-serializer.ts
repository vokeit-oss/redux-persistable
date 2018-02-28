/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


import * as Immutable from 'immutable';
import { immutable as serializeImmutable } from 'remotedev-serialize';


export class ImmutableSerializer {
    protected serializer: {stringify: (state: any) => string, parse: (data: string) => any};
    
    
    constructor(records?: any[]) {
        this.setRecords(records);
    }
    
    
    /**
     * Set immutable records by replacing the serializer
     */
    public setRecords(records?: any[]): void {
        this.serializer = serializeImmutable(Immutable, Array.isArray(records) ? records : []);
    }
    
    
    /**
     * Serialize data (from state to string)
     */
    public serialize(state: any): string {
        return this.serializer.stringify(state);
    }
    
    
    /**
     * Parse serialized data (from string to state)
     */
    public parse(serialized: string): any {
        return this.serializer.parse(serialized);
    }
}