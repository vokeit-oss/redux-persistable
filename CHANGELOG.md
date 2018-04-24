### v2.0.3

- Fixed typing on ImmutableMerger to accept StateType being either an ImmutableStateType or a key-indexed object
- Fixed root reducer created in createStore() to check for a value received from storage or return the next state reduced from the originally specified reducer
- Wrapped LocalForage to fullfil the storage interface
- Updated dependencies

### v2.0.2

- Major rewrite and cleanup

### v2.0.0

- Upgraded immutablejs to 4.0.0-rc.9

### v1.0.2

- Fixed race condition leading to outdated state passed to reducers

### v0.1.0-beta.5

- Fixed flushing ActionBuffer

### v0.1.0-beta.4

- Actions with a "slice" property now always get buffered until their slice has been rehydrated, this should solve usual timing isues


### v0.1.0-beta.1

- Added versioned states with migrations applied directly after de-serialization from storage
- Changed TransformType to use better recognizable names transformDataToStorage and transformDataFromStorage
- Added documentation