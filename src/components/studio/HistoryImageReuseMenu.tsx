import { ChevronDownIcon, ImagePlusIcon, LoaderCircleIcon, PersonStandingIcon, RotateCcwIcon, ShirtIcon, UserRoundIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ReferenceSlot } from '@/lib/randomRecipe'
import type { ExtraReferenceImage } from '@/types/gallery'

export type HistoryImageReuseTarget = { slot: ReferenceSlot } | { slot: 'extra'; id?: string }

export function HistoryImageReuseMenu({ extraImages, disabled, loading, onSelect }: {
  extraImages: ExtraReferenceImage[]
  disabled: boolean
  loading: boolean
  onSelect: (target: HistoryImageReuseTarget) => void
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" className="min-h-11 w-full" disabled={disabled} aria-busy={loading}>
        {loading ? <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" /> : <RotateCcwIcon className="size-3.5" />}
        {loading ? '正在复用…' : '复用结果'}
        <ChevronDownIcon className="ml-auto size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem className="min-h-11" onSelect={() => onSelect({ slot: 'portrait' })}><UserRoundIcon />用作人像</DropdownMenuItem>
      <DropdownMenuItem className="min-h-11" onSelect={() => onSelect({ slot: 'pose' })}><PersonStandingIcon />用作姿势</DropdownMenuItem>
      <DropdownMenuItem className="min-h-11" onSelect={() => onSelect({ slot: 'costume' })}><ShirtIcon />用作服装</DropdownMenuItem>
      {extraImages.length === 0 ? (
        <DropdownMenuItem className="min-h-11" onSelect={() => onSelect({ slot: 'extra' })}><ImagePlusIcon />用作附图</DropdownMenuItem>
      ) : (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="min-h-11"><ImagePlusIcon />用作附图</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 w-64 overflow-y-auto">
            <DropdownMenuItem className="min-h-11" onSelect={() => onSelect({ slot: 'extra' })}><ImagePlusIcon />新增附图</DropdownMenuItem>
            <DropdownMenuSeparator />
            {extraImages.map((image, index) => (
              <DropdownMenuItem key={image.id} className="min-h-11" onSelect={() => onSelect({ slot: 'extra', id: image.id })}>
                <span className="truncate" title={image.name}>替换附图 #{index + 1} · {image.name || '未命名'}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
}
