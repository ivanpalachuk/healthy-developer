import chalk from 'chalk'

// DOS-style ASCII art block font for "HD"
const ART = `
 ██╗  ██╗██████╗
 ██║  ██║██╔══██╗
 ███████║██║  ██║
 ██╔══██║██║  ██║
 ██║  ██║██████╔╝
 ╚═╝  ╚═╝╚═════╝ `

export function printBanner(version: string) {
  const lines = ART.split('\n')
  const tag   = ' healthy-developer'
  const sub   = ' wellness for builders'
  const ver   = ` v${version}`

  // Attach labels to the right of the art
  const labeled = lines.map((line, i) => {
    if (i === 2) return chalk.cyan(line) + chalk.bold.white(tag)
    if (i === 3) return chalk.cyan(line) + chalk.gray(sub)
    if (i === 4) return chalk.cyan(line) + chalk.gray(ver)
    return chalk.cyan(line)
  })

  console.log(labeled.join('\n'))
  console.log()
}
