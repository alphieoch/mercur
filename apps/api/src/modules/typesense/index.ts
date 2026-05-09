import { Module } from '@medusajs/framework/utils'

import TypesenseModuleService from './service'

export const TYPESENSE_MODULE = 'typesense'
export { TypesenseModuleService }

export default Module(TYPESENSE_MODULE, {
  service: TypesenseModuleService,
})
