import { getConfig } from "./actions"
import ConfiguracionClient from "./ConfiguracionClient"

export default async function ConfiguracionPage() {
  const entries = await getConfig()
  return <ConfiguracionClient initialEntries={entries} />
}
