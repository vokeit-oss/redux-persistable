/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


export class SimpleSerializer {
    /**
     * Set immutable records / ignored for SimpleSerializer
     */
    public setRecords(records: any[]): void {
    }
    
    
    /**
     * Serialize data (from state to string)
     */
    public serialize(state: any): string {
        return JSON.stringify(state);
    }
    
    
    /**
     * Parse serialized data (from string to state)
     */
    public parse(data: string): any {
        return JSON.parse(data);
    }
}