'use strict';

const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const fs           = require('fs-extra');
const globule      = require('globule');
const gulp         = require('gulp');
const log          = require('fancy-log');
const path         = require('path');
const plumber      = require('gulp-plumber');
const spawn        = require('child_process').spawn;
const spawnSync    = require('child_process').spawnSync;

gulp.task('node-info', () => {
	log(`Node.js ${process.version} (${process.platform})`);
	log(process.env);
});

/*
 * lint tasks
 */
gulp.task('lint', () => {
	return gulp
		.src([
			path.join(__dirname, 'packages/*/gulpfile.js')
		])
		.pipe(debug({ title: 'Linting project:' }))
		.pipe(plumber())
		.pipe(chug({ tasks: [ 'lint' ] }));
});

/*
 * build tasks
 */
gulp.task('build', () => runLernaBuild());

/*
 * test tasks
 */
gulp.task('test', [ 'node-info', 'build' ], cb => runTests(false, cb));
gulp.task('coverage', [ 'node-info', 'build' ], cb => runTests(true, cb));

function runTests(cover, cb) {
	const istanbul = require('istanbul');
	let task = cover ? 'coverage-only' : 'test-only';
	let coverageDir;
	let collector;

	if (cover) {
		coverageDir = path.join(__dirname, 'coverage');
		collector = new istanbul.Collector();
	}

	process.env.SNOOPLOGG = '*';

	const gulp = path.join(path.dirname(require.resolve('gulp')), 'bin', 'gulp.js');
	const gulpfiles = globule.find([ 'packages/*/gulpfile.js' ]);
	const failedProjects = [];

	gulpfiles
		.reduce((promise, gulpfile) => {
			return promise
				.then(() => new Promise((resolve, reject) => {
					gulpfile = path.resolve(gulpfile);
					const dir = path.dirname(gulpfile);

					log(`Spawning: ${process.execPath} ${gulp} coverage # CWD=${dir}`);
					const child = spawn(process.execPath, [ gulp, task, '--colors' ], { cwd: dir, stdio: [ 'inherit', 'pipe', 'inherit' ] });

					let out = '';
					child.stdout.on('data', data => {
						out += data.toString();
						process.stdout.write(data);
					});

					child.on('close', code => {
						if (!code) {
							log(`Exit code: ${code}`);
							if (cover) {
								for (const coverageFile of globule.find(dir + '/coverage/coverage*.json')) {
									collector.add(JSON.parse(fs.readFileSync(path.resolve(coverageFile), 'utf8')));
								}
							}
						} else if (out.indexOf(`Task '${task}' is not in your gulpfile`) === -1) {
							log(`Exit code: ${code}`);
							failedProjects.push(path.basename(dir));
						} else {
							log(`Exit code: ${code}, no '${task}' task, continuing`);
						}

						resolve();
					});
				}));
		}, Promise.resolve())
		.then(() => {
			if (cover) {
				fs.removeSync(coverageDir);
				fs.mkdirsSync(coverageDir);
				console.log();

				for (const type of [ 'lcov', 'json', 'text', 'text-summary', 'cobertura' ]) {
					istanbul.Report
						.create(type, { dir: coverageDir })
						.writeReport(collector, true);
				}
			}

			if (!failedProjects.length) {
				return cb();
			}

			if (failedProjects.length === 1) {
				log(red('1 failured project:'));
			} else {
				log(red(`${failedProjects.length} failured projects:`));
			}
			failedProjects.forEach(p => log(red(p)));
			process.exit(1);
		})
		.catch(cb);
}

/*
 * watch task
 */
gulp.task('watch', [ 'build' ], cb => {
	const watchers = [
		gulp.watch(`${__dirname}/packages/*/src/**/*.js`, evt => {
			evt.path = evt.path.replace(/\\/g, '/');
			const m = evt.path.match(new RegExp('^(' +  __dirname.replace(/\\/g, '/') + '/(packages/([^\/]+)))'));
			if (m) {
				log(`Detected change: ${evt.path}`);
				const pkgJson = path.join(m[1], 'package.json');

				try {
					runLernaBuild(JSON.parse(fs.readFileSync(pkgJson)).name);
				} catch (e) {
					log(`Failed to read/parse ${pkgJson}: ${e.toString()}`);
				}
			}
		})
	];

	let stopping = false;

	process.on('SIGINT', () => {
		if (!stopping) {
			stopping = true;
			for (const w of watchers) {
				w._watcher.close();
			}
			cb();
		}
	});
});

function runLernaBuild(scope) {
	let { execPath } = process;
	const args = [ './node_modules/.bin/lerna', 'run', 'build', '--parallel' ];

	if (process.platform === 'win32') {
		args.shift();
		execPath = path.join(__dirname, 'node_modules', '.bin', 'lerna.cmd');
	}

	if (scope) {
		args.push('--scope', scope);
	}

	log(`Running ${execPath} ${args.join(' ')}`);
	spawnSync(execPath, args, { stdio: 'inherit' });
}
