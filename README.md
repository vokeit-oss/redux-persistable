# redux-persistable

State persistance for redux stores supporting immutable.js, lazy reducers, versioned states, migrations and merged storage


## Features

- Supports immutable.js for the whole state
- Supports lazily added reducers by storing the slices of state in separate storage keys
  - Hooks into redux' replaceReducer() to catch up with new reducer map
  - Dispatches rehydrate actions for every slice for reducers to implement custom rehydration logic
  - Dispatches rehydrated actions for every slice to inform the app that a new slice has been loaded and rehydrated
- ActionBuffer while rehydrating
  - Hooks into redux' dispatch() to buffer dispatched actions while rehydration is in progress
  - Flushes action buffer in FIFO order after rehydration finished
- Versioned states, versions are persisted with the state slices but not published to the state upon loading to not clutter it with internals
- Migrations from old state versions to latest by specifying migration functions
  - Migrations are processed in serial order so there's no need to bloat them with steps for all possible previous versions
  - Example: Input version: 2, migration versions: 2, 3, 4, 5, redux-persistable will pass input to migration "3", the result of this to "4" and that to "5" 
  - Migration functions can process multiple version steps at once, they have to return the version the migrated state is in
  - Example: Input version: 2, migration versions: 2, 5, 10, redux-persistable will pass input to migration "5" which handles migrations from 2 to 5 and will pass the result to "10" which handles migration from 5 to 10
- Multiple storages available: LocalForage, native LocalStorage, native SessionStorage, MergedStorage
  - MergedStorage: store slices of the state to different storages (e.g. LocalStorage and SessionStorage) and automatically merge them upon loading
  - Filtering for MergedStorage is done by transforms, e.g. by using createFilter of [@actra-development-oss/redux-persist-transform-filter-immutable](https://github.com/actra-development-oss/redux-persist-transform-filter-immutable)
  - Custom mergers possible, ships with plain object merging (spread operator) and immutable merger (mergeDeep)
  - Custom serializers possible, ships with simple serializer (JSON.stringify / JSON.parse) and immutable serializer ( [remotdev-serialize}(https://github.com/zalmoxisus/remotedev-serialize) / [jsan](https://github.com/kolodny/jsan) )


## Usage

```typescript
import {
    combineReducers,
    immutableMerger,
    ImmutableSerializer,
    LocalstorageStorage,
    MergerType,
    persistableEnhancer,
    SerializerType,
    TransformType
} from '@actra-development-oss/redux-persistable/lib';
import {
    Map,
    Record
} from 'immutable';
import {
    Action,
    applyMiddleware,
    compose,
    createStore,
    Reducer
} from 'redux';

const reducers: {[key: string]: Reducer<any>} = {
    myReducerOne: (state: any, action: Action) => state,
    myReducerTwo: (state: any, action: Action) => state
};
const initialState: Map                       = Map({
    myReducerOne: Map({
        myInfoOne: 'abc',
        myInfoTwo: '123',
    }),
    myReducerTwo: Map({
        myInfoThree: 'def',
        myInfoFour:  '456',
    })
});
const immutableRecords: Record<string, any>[] = [];
const transforms: TransformType[]             = [];
const middlewares: Middleware[]               = [];
const merger: MergerType                      = immutableMerger;
const serializer: SerializerType              = new ImmutableSerializer(immutableRecords);
const storage: StorageType                    = new LocalstorageStorage(serializer, transforms);

const store = createStore(
    Object.keys(reducers).length ? combineReducers(reducers, Map()) : (state: any, action: Action) => state,
    initialState,
    compose(
        persistableEnhancer({
            merger:     merger,
            storage:    storage,
            storageKey: 'my-store',
            version:    1
        }),
        applyMiddleware(...middlewares)
    )
);
```


## Merged storage

Allows to store parts of the state to different storages, e.g. to store basic settings like the locale in permanent storage but others like session id to temporary storage.
Merging is applied in the order the storages where added (from left to right in terms of e.g. Object.assign()) meaning the same key from the second storage overrides the one from the first storage.
Filtering the data to store is up to the developer, it is applied by state transforms upon persisting (right before serialization) and loading (right after de-serialization and migrations).

```typescript
import createFilter from '@actra-development-oss/redux-persist-transform-filter-immutable';
import {
    immutableMerger,
    LocalstorageStorage,
    MergedStorage,
    SessionstorageStorage
} from '@actra-development-oss/redux-persistable/lib';
// ...other imports, see usage section

const mergedStorage                        = new MergedStorage(Map(), immutableMerger);
const permanentTransforms: TransformType[] = [
    createFilter('myReducerOne', ['myInfoOne'], ['myInfoOne'], 'whitelist'),
    createFilter('myReducerTwo', ['myInfoThree'], ['myInfoThree'], 'whitelist'),
];
const temporaryTransforms: TransformType[] = [
    createFilter('myReducerOne', ['myInfoTwo'], ['myInfoTwo'], 'whitelist'),
    createFilter('myReducerTwo', ['myInfoFour'], ['myInfoFour'], 'whitelist')
];
// ...other declarations, see usage section

mergedStorage.addStorage('my-permanent-storage', new LocalstorageStorage(serializer, permanentTransforms));
mergedStorage.addStorage('my-temporary-storage', new SessionstorageStorage(serializer, temporaryTransforms));

const store = createStore(
    Object.keys(this.reducers).length ? combineReducers(reducers, Map()) : (state: any, action: Action) => state,
    initialState,
    compose(
        persistableEnhancer({
            merger:     merger,
            storage:    mergedStorage,
            storageKey: 'my-store',
            version:    1
        }),
        applyMiddleware(...middlewares)
    )
)
```


## Thanks

Thanks to Zack Story for [redux-persist](https://github.com/rt2zz/redux-persist) that I used previously and that inspired me to build my own solution when immutable.js got effectivly unusable with v5
Thanks to zalmoxisus for [remotedev-serialize](https://github.com/zalmoxisus/remotedev-serialize), a great serializer for immutables, and [jsan](https://github.com/zalmoxisus/jsan), a great general-purpose JSON serializer