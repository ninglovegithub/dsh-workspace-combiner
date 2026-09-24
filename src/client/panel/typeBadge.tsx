import type { ReactElement } from 'react'
import type { ProjectType } from '../../core/types.ts'
import { tt, type WorkspaceCombinerKey } from '../locales.ts'

const TYPE_CLASS: Record<ProjectType, string> = {
  java: 'wcb-type-java',
  frontend: 'wcb-type-frontend',
  'frontend-vue': 'wcb-type-frontend',
  'frontend-react': 'wcb-type-frontend',
  'frontend-webpack': 'wcb-type-frontend',
  'frontend-next': 'wcb-type-frontend',
  python: 'wcb-type-python',
  go: 'wcb-type-go',
  generic: 'wcb-type-generic',
  none: 'wcb-type-none',
}

const TYPE_KEY: Record<ProjectType, WorkspaceCombinerKey> = {
  java: 'typeJava',
  frontend: 'typeFrontend',
  'frontend-vue': 'typeFrontendVue',
  'frontend-react': 'typeFrontendReact',
  'frontend-webpack': 'typeFrontendWebpack',
  'frontend-next': 'typeFrontendNext',
  python: 'typePython',
  go: 'typeGo',
  generic: 'typeGeneric',
  none: 'typeNone',
}

/** 类型 -> CSS 类（vue/react/webpack/next 统一前端色）。 */
export function typeClass(type: ProjectType): string {
  return TYPE_CLASS[type]
}

/** 类型 -> 本地化标签。 */
export function typeLabel(type: ProjectType): string {
  return tt(TYPE_KEY[type])
}

/** 项目类型徽标。 */
export function TypeBadge({ type, evidence }: { type: ProjectType; evidence?: string }): ReactElement {
  return (
    <span className={'wcb-type ' + typeClass(type)} title={evidence !== undefined && evidence !== '' ? tt('evidenceHint', { evidence }) : undefined}>
      {typeLabel(type)}
    </span>
  )
}
