/**
 * @author Gabriel Schuster <opensource@actra.de>
 */


const path    = require('path');
const webpack = require('webpack');


const config = {
    devtool: 'source-map',
    entry: {
        'redux-persistable':     [path.resolve(__dirname, 'src/index.ts')],
        'redux-persistable.min': [path.resolve(__dirname, 'src/index.ts')]
    },
    module: {
        rules: [
            {
                test:    /\.ts?$/,
                exclude: /node_modules/,
                use:     [
                    {
                        loader:  'awesome-typescript-loader',
                        options: {
                            declaration:     false,
                            inlineSourceMap: true,
                            inlineSources:   true,
                            removeComments:  true,
                            sourceMap:       false
                        }
                    }
                ]
            }
        ]
    },
    output: {
        path:           path.resolve(__dirname, 'dist/_bundles'),
        filename:       '[name].js',
        libraryTarget:  'umd',
        library:        'redux-persistable',
        umdNamedDefine: true
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            minimize:  true,
            sourceMap: true,
            include:   /\.min\.js$/,
        })
    ],
    resolve: {
        extensions: ['.ts', '.js']
    }
}


module.exports = config;