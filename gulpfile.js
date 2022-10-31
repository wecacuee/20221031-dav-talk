const pkg = require('./package.json')
const path = require('path')
const glob = require('glob')
const yargs = require('yargs')
const colors = require('colors')
const qunit = require('node-qunit-puppeteer')

const {rollup} = require('rollup')
const {terser} = require('rollup-plugin-terser')
const babel = require('@rollup/plugin-babel').default
const commonjs = require('@rollup/plugin-commonjs')
const resolve = require('@rollup/plugin-node-resolve').default

const gulp = require('gulp')
const tap = require('gulp-tap')
const zip = require('gulp-zip')
const sass = require('gulp-sass')
const header = require('gulp-header')
const eslint = require('gulp-eslint')
const minify = require('gulp-clean-css')
const connect = require('gulp-connect')
const autoprefixer = require('gulp-autoprefixer')

const root = yargs.argv.root || '.'
const port = yargs.argv.port || 8000


gulp.task('reload', () => gulp.src(['*.html', '*.js', '*.css', '*.md'])
    .pipe(connect.reload()));

gulp.task('serve', () => {

    connect.server({
        root: root,
        port: port,
        host: '0.0.0.0',
        livereload: true
    })

    gulp.watch(['*.html', '*.js', '*.css', '*.md'], gulp.series('reload'))


})
