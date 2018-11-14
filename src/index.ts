const fs = require('fs').promises
const path = require('path')
const { spawn } = require('child_process')
const isUrl = require('is-url')
const os = require('os')
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

module.exports = async (
  repo: string,
  fork: string,
  { diff }: { diff: string }
) => {
  if (isUrl(repo) || /[@:]/.test(repo)) {
    const repoTmp = await fs.mkdtemp(os.tmpdir() + '/')
    await spawnPromise('git', 'clone', repo, repoTmp)
    repo = repoTmp
  }
  if (!await fs.stat(fork).catch(() => null)) {
    await spawnPromise('cp', '-r', repo, fork)
  }

  const filename = path.join(fork, '.diff')
  await fs.writeFile(filename, diff)
  const result = await spawnPromiseOptions({ cwd: fork }, 'git', 'apply', '.diff')

  console.log(result)
}

module.exports.maintain = async (
  repo: string,
  fork: string,
  { diff }: { diff: string }
) => {
  if (!await fs.stat(fork).catch(() => null)) {
    return module.exports(repo, fork, { diff })
  }

  await spawnPromiseOptions({ cwd: fork }, 'git', 'remote', 'add', 'foo', path.relative(fork, repo))
  await spawnPromiseOptions({ cwd: fork }, 'git', 'fetch', 'foo')
  await spawnPromiseOptions({ cwd: fork }, 'git', 'rebase', 'foo/master')
}
