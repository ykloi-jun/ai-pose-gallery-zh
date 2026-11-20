import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanSearchIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/lib/notifications'
import { Field, Section } from '@/components/common/FormSection'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { detectComfyUi, PROVIDER_META } from '@/services/aiGenerator'
import { useStudio } from '@/store/studioStore'
import type { ImagePassMode, ImageProviderId, PromptEnhancerConfig } from '@/types/gallery'
import { ComfyConnectionStatus } from '@/components/studio/ComfyConnectionStatus'
import { COMFY_CONNECTION_LABELS } from '@/store/useComfyConnection'
import { fetchRelayModels, relayModelIds, RELAY_ENDPOINTS } from '@/services/relay'

export const Route = createFileRoute('/settings')({
  staticData: { title: 'API 配置' },
  component: SettingsPage,
})

const PROVIDER_ORDER: ImageProviderId[] = ['gemini', 'gpt', 'relay', 'qwen', 'doubao', 'pixai', 'comfyui']

function SettingsPage() {
  const { apiConfig, updateApiConfig, updateProviderConfig, setFetchedRelayModels, comfyConnection } = useStudio()
  const [showKey, setShowKey] = useState(false)
  const [showPromptEnhancerKey, setShowPromptEnhancerKey] = useState(false)
  const [testingComfy, setTestingComfy] = useState(false)
  const [loadingRelayModels, setLoadingRelayModels] = useState(false)
  const [relayModelInput, setRelayModelInput] = useState('')

  const pid = apiConfig.activeProvider
  const meta = PROVIDER_META[pid]
  const pCfg = apiConfig.providers[pid]
  const promptEnhancer = apiConfig.promptEnhancer
  const updatePromptEnhancer = (patch: Partial<PromptEnhancerConfig>) =>
    updateApiConfig({ promptEnhancer: { ...promptEnhancer, ...patch } })
  const relay = apiConfig.providers.relay
  const relayModels = relayModelIds(relay)

  const handleFetchRelayModels = async () => {
    setLoadingRelayModels(true)
    try {
      const models = await fetchRelayModels(relay, relay.useProxy)
      setFetchedRelayModels(relay, models)
      if (!models.length) {
        toast.info('接口可用，但没有返回模型；请手动添加模型 ID')
      } else {
        toast.success(`已拉取 ${models.length} 个模型`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '拉取模型失败')
    } finally {
      setLoadingRelayModels(false)
    }
  }

  const handleAddRelayModel = () => {
    const model = relayModelInput.trim()
    if (!model) return
    const manualModels = relay.manualModels.includes(model) ? relay.manualModels : [...relay.manualModels, model]
    updateProviderConfig('relay', { manualModels, model })
    setRelayModelInput('')
    toast.success(`已添加并选择 ${model}`)
  }

  const handleDetectComfy = async () => {
    setTestingComfy(true)
    try {
      const found = await detectComfyUi(pCfg.baseUrl, pCfg.apiKey)
      if (!found) {
        toast.error('未找到可用的 ComfyUI（已尝试当前地址、127.0.0.1:8000、127.0.0.1:8188），请确认已启动并检查跨域设置', {
          duration: 10000,
        })
        return
      }
      updateProviderConfig('comfyui', { baseUrl: found.baseUrl })
      toast.success(`已识别：${found.info}（${found.baseUrl}）`)
    } finally {
      setTestingComfy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="API 接口配置"
        actions={
          <Button size="sm" asChild>
            <Link to="/studio">
              <SparklesIcon className="size-4" />
              返回合成台
            </Link>
          </Button>
        }
      />

      {/* 接口切换标签 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PROVIDER_ORDER.map((id) => {
          const itemMeta = PROVIDER_META[id]
          const isActive = pid === id
          const hasKey =
            id === 'comfyui'
              ? Boolean(apiConfig.providers.comfyui.baseUrl.trim())
              : Boolean(apiConfig.providers[id].apiKey.trim())
          return (
            <button
              key={id}
              type="button"
              onClick={() => updateApiConfig({ activeProvider: id })}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/6 font-semibold shadow-xs'
                  : 'border-border/60 bg-card hover:bg-muted/40'
              }`}
            >
              <span className="min-w-0"><span className="block truncate text-sm">{itemMeta.name}</span><span className="block text-xs font-normal text-muted-foreground">{id === 'comfyui' ? COMFY_CONNECTION_LABELS[comfyConnection.status] : hasKey ? '已配置' : '未配置 Key'}</span></span>
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  id === 'comfyui' && comfyConnection.status === 'connected' ? 'bg-emerald-500' : hasKey ? 'bg-amber-500' : 'bg-muted-foreground/30'
                }`}
                title={id === 'comfyui' ? COMFY_CONNECTION_LABELS[comfyConnection.status] : hasKey ? '已配置，尚未检测' : '未配置 Key'}
              />
            </button>
          )
        })}
      </div>

      {pid === 'comfyui' && <ComfyConnectionStatus />}

      {/* 当前厂商连接配置 */}
      <Section
        title={`${meta.name} 连接配置`}
        actions={
          <div className="flex items-center gap-1.5">
            {pid === 'relay' && (
              <Button variant="outline" size="sm" onClick={handleFetchRelayModels} disabled={loadingRelayModels || !relay.baseUrl.trim() || !relay.apiKey.trim()}>
                <DownloadIcon className={`size-3.5 ${loadingRelayModels ? 'animate-bounce' : ''}`} />
                {loadingRelayModels ? '拉取中…' : '拉取模型'}
              </Button>
            )}
            {pid === 'comfyui' && (
              <>
                <Button variant="outline" size="sm" onClick={handleDetectComfy} disabled={testingComfy}>
                  <ScanSearchIcon className="size-3.5" />
                  自动识别
                </Button>
              </>
            )}
            {meta.docUrl && <Button variant="ghost" size="sm" asChild>
              <a href={meta.docUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" />
                文档
              </a>
            </Button>}
            <Button
              variant="ghost"
              size="sm"
              disabled={pid === 'relay' && loadingRelayModels}
              onClick={() => {
                if (pid === 'relay') {
                  updateProviderConfig('relay', { baseUrl: '', fetchedModels: [], model: relay.manualModels[0] ?? '', useProxy: false })
                  updateApiConfig({ relayEndpointMode: 'images_edits_json' })
                } else {
                  updateProviderConfig(pid, { baseUrl: meta.defaultBaseUrl, model: meta.models[0].value })
                }
                toast.success('已恢复默认')
              }}
            >
              <RotateCcwIcon className="size-3.5" />
              重置
            </Button>
          </div>
        }
      >
        <Field
          label={pid === 'comfyui' ? 'ComfyUI 地址 (Base URL)' : 'Base URL'}
          htmlFor="provider-base-url"
          hint={
            pid === 'relay'
              ? '填写中转站兼容 OpenAI API 的根地址或 /v1 地址。服务端代理仅允许 HTTPS，并受 PROXY_ALLOWED_ORIGINS 白名单限制。'
              : pid === 'comfyui'
              ? `本地运行本站时填 /comfy（同源代理，无需改跨域设置）；直连时 ComfyUI 需加启动参数 --enable-cors-header "${typeof window !== 'undefined' ? window.location.origin : '*'}"。Desktop 版默认端口 8000，便携版 8188`
              : undefined
          }
        >
          <Input
            id="provider-base-url"
            disabled={pid === 'pixai' || (pid === 'relay' && loadingRelayModels)}
            type={pid === 'comfyui' ? 'text' : 'url'}
            value={pCfg.baseUrl}
            onChange={(e) => {
              const baseUrl = e.target.value
              if (pid === 'relay') {
                const model = relay.manualModels.includes(relay.model) ? relay.model : relay.manualModels[0] ?? ''
                updateProviderConfig('relay', { baseUrl, fetchedModels: [], model })
              } else {
                updateProviderConfig(pid, { baseUrl })
              }
            }}
            placeholder={pid === 'relay' ? 'https://relay.example.com/v1' : meta.defaultBaseUrl}
          />
        </Field>

        <Field label={pid === 'comfyui' ? 'API Key（可选，本地留空）' : 'API Key'} htmlFor="provider-api-key">
          <div className="relative">
            <Input
              id="provider-api-key"
              type={showKey ? 'text' : 'password'}
              disabled={pid === 'relay' && loadingRelayModels}
              autoComplete="off"
              value={pCfg.apiKey}
              onChange={(e) => {
                const apiKey = e.target.value
                if (pid === 'relay') {
                  const model = relay.manualModels.includes(relay.model) ? relay.model : relay.manualModels[0] ?? ''
                  updateProviderConfig('relay', { apiKey, fetchedModels: [], model })
                } else {
                  updateProviderConfig(pid, { apiKey })
                }
              }}
              placeholder={
                pid === 'comfyui'
                  ? '本地 ComfyUI 无需填写，远程鉴权可填 Token'
                  : '输入 API Key（仅保存在本地浏览器）'
              }
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </Field>

        {pid === 'relay' && (
          <>
            <Field label="模型" htmlFor="relay-model" hint={relayModels.length ? `已保存 ${relayModels.length} 个模型 ID。请选择支持图像输出的模型。` : '可拉取模型列表，也可手动添加服务商提供的模型 ID。'}>
              <Select value={relay.model} disabled={!relayModels.length} onValueChange={(model) => updateProviderConfig('relay', { model })}>
                <SelectTrigger id="relay-model" className="w-full font-mono text-xs">
                  <SelectValue placeholder="选择已保存的模型" />
                </SelectTrigger>
                <SelectContent position="popper" className="w-(--radix-select-trigger-width)">
                  {relayModels.map((model) => (
                    <SelectItem key={model} value={model} className="font-mono text-xs [overflow-wrap:anywhere]">{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="手动添加模型 ID" htmlFor="relay-manual-model">
              <div className="flex gap-2">
                <Input
                  id="relay-manual-model"
                  value={relayModelInput}
                  onChange={(e) => setRelayModelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleAddRelayModel()
                    }
                  }}
                  placeholder="例如 provider/image-model"
                  className="font-mono text-xs"
                />
                <Button type="button" variant="outline" onClick={handleAddRelayModel} disabled={!relayModelInput.trim()}>
                  <PlusIcon />
                  添加
                </Button>
              </div>
              {relay.manualModels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {relay.manualModels.map((model) => (
                    <div key={model} className="flex min-w-0 max-w-full items-center gap-2 rounded-md border px-2 py-1 font-mono text-xs">
                      <span className="truncate" title={model}>{model}</span>
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`移除手动添加的模型 ${model}`}
                        onClick={() => {
                          const manualModels = relay.manualModels.filter((item) => item !== model)
                          const modelStillAvailable = relay.model !== model || relay.fetchedModels.includes(model)
                          const selectedModel = modelStillAvailable ? relay.model : manualModels[0] ?? relay.fetchedModels[0] ?? ''
                          updateProviderConfig('relay', { manualModels, model: selectedModel })
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
            <Field label="生图接口协议" htmlFor="relay-endpoint-mode" hint="按中转站支持的图像接口选择。">
              <Select value={apiConfig.relayEndpointMode} onValueChange={(value) => updateApiConfig({ relayEndpointMode: value as typeof apiConfig.relayEndpointMode })}>
                <SelectTrigger id="relay-endpoint-mode" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RELAY_ENDPOINTS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="通过本站代理转发" hint="开启可绕过浏览器跨域限制。中转站域名必须加入部署环境的 PROXY_ALLOWED_ORIGINS。">
              <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
                <span className="text-xs text-muted-foreground">{relay.useProxy ? '已启用' : '浏览器直连'}</span>
                <Switch aria-label="通过本站代理转发" checked={relay.useProxy} disabled={loadingRelayModels} onCheckedChange={(useProxy) => updateProviderConfig('relay', { useProxy })} />
              </div>
            </Field>
          </>
        )}

        {pid !== 'comfyui' && pid !== 'relay' && (
          <Field label="默认模型 ID">
            <Select
              value={pCfg.model}
              onValueChange={(v) => updateProviderConfig(pid, { model: v })}
            >
              <SelectTrigger className="w-full font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.models.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="font-mono text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {pid !== 'comfyui' && pid !== 'relay' && pCfg.model === 'custom' && (
          <Field label="自定义模型 ID">
            <Input
              value={pCfg.customModel}
              onChange={(e) => updateProviderConfig(pid, { customModel: e.target.value })}
              placeholder={pid === 'doubao' ? 'ep-2026xxxx 或模型 ID' : '输入模型 ID'}
              className="font-mono text-xs"
            />
          </Field>
        )}
      </Section>

      <Section
        title="AI 提示词增强接口"
        desc="在生成台将当前提示词和参考图组合说明发送给兼容 OpenAI Chat Completions 的文本模型，返回内容会放回提示词框供你编辑。"
      >
        <Field label="Base URL" hint="填写兼容 OpenAI API 的根地址，例如 https://api.openai.com/v1；其他域名需加入服务端 PROXY_ALLOWED_ORIGINS。">
          <Input
            type="url"
            value={promptEnhancer.baseUrl}
            onChange={(e) => updatePromptEnhancer({ baseUrl: e.target.value })}
            placeholder="https://api.openai.com/v1"
          />
        </Field>
        <Field label="API Key" hint="保存在当前浏览器配置中；调用时由同源后端转发至此模型服务。">
          <div className="relative">
            <Input
              type={showPromptEnhancerKey ? 'text' : 'password'}
              value={promptEnhancer.apiKey}
              onChange={(e) => updatePromptEnhancer({ apiKey: e.target.value })}
              placeholder="输入提示词增强模型 API Key"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPromptEnhancerKey((visible) => !visible)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPromptEnhancerKey ? '隐藏增强模型 API Key' : '显示增强模型 API Key'}
            >
              {showPromptEnhancerKey ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </Field>
        <Field label="模型 ID">
          <Input
            value={promptEnhancer.model}
            onChange={(e) => updatePromptEnhancer({ model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="font-mono text-xs"
          />
        </Field>
      </Section>

      {pid === 'comfyui' && (
        <p className="text-sm text-muted-foreground">模型由工作流决定。请返回合成台导入工作流，并设置人像、服装和姿势节点。</p>
      )}

      {/* 全局传输设置 */}
      {pid === 'pixai' && <p className="text-sm text-muted-foreground">支持 Tsubaki.3 和 Tsubaki.3 Flash，每次输出一张。人像、服装、姿势各一图，按原始图片上传；默认启用本站代理。Key 随请求发送到本站代理与 PixAI，请仅在可信部署上使用。</p>}
      {pid !== 'comfyui' && (
        <Section title="全局请求选项">
          {pid !== 'pixai' && <Field label="参考图传参方式">
            <Select
              value={apiConfig.imagePassMode}
              onValueChange={(v) => updateApiConfig({ imagePassMode: v as ImagePassMode })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="url">传递图片 URL（免上传文件，推荐）</SelectItem>
                <SelectItem value="base64">转 Base64 编码传输</SelectItem>
              </SelectContent>
            </Select>
          </Field>}

          {pid !== 'relay' && <Field
            label="服务端 CORS 代理 (/api/proxy)"
            hint="默认关闭（浏览器直连）；切换到阿里云百炼 (Qwen)、火山方舟 (Doubao) 或 PixAI 时会自动开启。仅支持白名单域名（可通过服务端环境变量 PROXY_ALLOWED_ORIGINS 扩展）"
          >
            <div className="flex h-9 items-center justify-between rounded-xl border bg-background px-3">
              <span className="text-xs text-muted-foreground">
                {apiConfig.useProxy ? '已启用（解决跨域限制）' : '已关闭（浏览器直连）'}
              </span>
              <Switch
                checked={apiConfig.useProxy}
                onCheckedChange={(v) => updateApiConfig({ useProxy: v })}
              />
            </div>
          </Field>}
        </Section>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => {
          if (pid === 'relay' && relayModelInput.trim()) handleAddRelayModel()
          else toast.success('配置已保存')
        }}>
          <CheckIcon className="size-4" />
          保存配置
        </Button>
      </div>
    </>
  )
}
