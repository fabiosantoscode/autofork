const fs = require('fs').promises
const path = require('path')
const { spawn } = require('child_process')
const isUrl = require('is-url')
const os = require('os')
const rimraf = require('rimraf')
const shellescape = require('shell-escape')

const spawnPromise = (cmd: string, ...args: string[]) => spawnPromiseOptions({}, cmd, ...args)
const spawnPromiseOptions = (opt: any, cmd: string, ...args: string[]) => new Promise((resolve, reject) => {
  let stdout = ''
  const cp = spawn(cmd, args, opt)
  .on('close', (code: number) => {
    if (code) reject(new Error('process ' + cmd + ' ' + args.join(' ') + ' has exited with code ' + code))
    resolve(stdout)
  })
  cp.stdout.on('data', (d: Buffer) => {
    stdout += d
  })
  cp.stderr.on('data', (d: Buffer) => {
    console.log('stderr: ' + d)
  })
})

const isAUrl = (url: string) => isUrl(url) || /[@:]/.test(url)

const possiblyFetch = async (repo: string) => {
  if (isAUrl(repo)) {
    const repoTmp = await fs.mkdtemp(os.tmpdir() + '/')
    await spawnPromise('git', 'clone', repo, repoTmp)
    return repoTmp
  }
  return repo
}

const possiblyRemove = async (repo: string, originalRepo: string) => {
  if (isAUrl(originalRepo)) {
    await new Promise(resolve => { rimraf(repo, resolve) })
  }
}

module.exports = async (
  originalRepo: string,
  originalFork: string,
  { diff }: { diff: string }
) => {
  const repo = await possiblyFetch(originalRepo)
  const fork = await possiblyFetch(originalFork)
  if (!await fs.stat(fork).catch(() => null)) {
    await spawnPromise('cp', '-r', repo, fork)
  }

  const filename = path.join(fork, '.diff')
  await fs.writeFile(filename, diff)
  await spawnPromiseOptions({ cwd: fork }, 'git', 'apply', '.diff')
  await spawnPromiseOptions({ cwd: fork }, 'git', 'commit', '-am', 'fork patch')

  if (isAUrl(originalFork)) {
    await spawnPromiseOptions({ cwd: fork }, 'git', 'push')
  }

  possiblyRemove(repo, originalRepo)
  possiblyRemove(fork, originalFork)
}

module.exports.maintain = async (
  originalRepo: string,
  originalFork: string,
  { diff }: { diff: string }
) => {
  const repo = await possiblyFetch(originalRepo)
  const fork = await possiblyFetch(originalFork)
  if (!await fs.stat(fork).catch(() => null)) {
    return module.exports(repo, fork, { diff })
  }

  await spawnPromiseOptions({ cwd: fork }, 'git', 'remote', 'add', 'foo', path.relative(fork, repo))
  await spawnPromiseOptions({ cwd: fork }, 'git', 'fetch', 'foo')
  await spawnPromiseOptions({ cwd: fork }, 'git', 'rebase', 'foo/master')

  if (isAUrl(originalFork)) {
    await spawnPromiseOptions({ cwd: fork }, 'git', 'push', '-f')
  }

  possiblyRemove(repo, originalRepo)
  possiblyRemove(fork, originalFork)
}
