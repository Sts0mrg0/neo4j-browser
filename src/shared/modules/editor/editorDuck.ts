/*
 * Copyright (c) 2002-2020 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import Rx from 'rxjs/Rx'
import { getUrlParamValue } from 'services/utils'
import { DISABLE_IMPLICIT_INIT_COMMANDS } from 'shared/modules/settings/settingsDuck'
import { APP_START, URL_ARGUMENTS_CHANGE } from 'shared/modules/app/appDuck'
import {
  commandSources,
  executeCommand
} from 'shared/modules/commands/commandsDuck'

const NAME = 'editor'
export const SET_CONTENT = `${NAME}/SET_CONTENT`
export const EDIT_CONTENT = `${NAME}/EDIT_CONTENT`
export const FOCUS = `${NAME}/FOCUS`
export const EXPAND = `${NAME}/EXPAND`
export const NOT_SUPPORTED_URL_PARAM_COMMAND = `${NAME}/NOT_SUPPORTED_URL_PARAM_COMMAND`

// Supported commands
const validCommandTypes: any = {
  play: (args: any) => `:play ${args.join(' ')}`,
  edit: (args: any) => args.join('\n'),
  param: (args: any) => `:param ${args.join(' ')}`,
  params: (args: any) => `:params ${args.join(' ')}`
}

export const setContent = (newContent: any) => ({
  type: SET_CONTENT,
  message: newContent
})
export const editContent = (
  id: any,
  message: any,
  {
    directory = null,
    name = null,
    isStatic = false,
    isProjectFile = false
  }: any = {}
) => ({
  type: EDIT_CONTENT,
  message,
  id,
  isProjectFile,
  isStatic,
  name,
  directory
})

export const populateEditorFromUrlEpic = (some$: any, _store: any) => {
  return some$
    .ofType(APP_START)
    .merge(some$.ofType(URL_ARGUMENTS_CHANGE))
    .delay(1) // Timing issue. Needs to be detached like this
    .mergeMap((action: any) => {
      if (!action.url) {
        return Rx.Observable.never()
      }
      const cmdParam = getUrlParamValue('cmd', action.url)

      // No URL command param found
      if (!cmdParam || !cmdParam[0]) {
        return Rx.Observable.never()
      }

      // Not supported URL param command
      if (!Object.keys(validCommandTypes).includes(cmdParam[0])) {
        return Rx.Observable.of({
          type: NOT_SUPPORTED_URL_PARAM_COMMAND,
          command: cmdParam[0]
        })
      }

      const commandType = cmdParam[0]
      // Credits to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent
      // for the "decodeURIComponent cannot be used directly to parse query parameters"
      const cmdArgs =
        getUrlParamValue(
          'arg',
          decodeURIComponent(action.url.replace(/\+/g, ' '))
        ) || []
      const fullCommand = validCommandTypes[commandType](cmdArgs)

      // Play command is considered safe and can run automatically
      // When running the explicit command, also set flag to skip any implicit init commands
      if (commandType === 'play') {
        return [
          executeCommand(fullCommand, { source: commandSources.url }),
          { type: DISABLE_IMPLICIT_INIT_COMMANDS }
        ]
      }

      return Rx.Observable.of(setContent(fullCommand))
    })
}
