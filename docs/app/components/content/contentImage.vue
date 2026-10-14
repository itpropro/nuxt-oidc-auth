<script setup lang="ts">
interface Props {
  src: string
  alt?: string
  title?: string
}

withDefaults(defineProps<Props>(), {
  alt: '',
  title: undefined,
})

const popoverId = useId()
const imagePopover = useTemplateRef<HTMLDivElement>('imagePopover')
const imageContent = useTemplateRef<HTMLDivElement>('imageContent')

onClickOutside(imageContent, closeModal)

function closeModal() {
  imagePopover.value?.hidePopover()
}
</script>

<template>
  <div class="flex justify-center">
    <button type="button" :popovertarget="popoverId">
      <NuxtImg
        :alt="alt"
        :src="src"
        fit="fill"
        sizes="100vw sm:50vw md:400px"
        class="mb-2 rounded-lg transition-[filter] dark:brightness-75 dark:hover:brightness-100 shadow-lg max-h-[500px]"
      />
      <p v-if="alt || title" class="text-center mt-0 opacity-70">
        {{ title || alt }}
      </p>
    </button>
    <div
      :id="popoverId"
      ref="imagePopover"
      popover="auto"
      class="transition-opacity ease-out transition-discrete h-full w-full bg-transparent p-0 justify-center place-items-center opacity-0 open:grid open:opacity-100 backdrop-blur-lg starting:open:opacity-0"
    >
      <div ref="imageContent" class="max-w-[80%]">
        <div class="flex justify-between h-10 pl-3 py-2 items-center mx-auto">
          <span class="text-xl font-bold">{{ title || alt }}</span>
          <button type="button" class="size-6" @click="closeModal">
            <UIcon name="i-carbon-close-outline" size="1.5rem" />
            <span class="sr-only">Close</span>
          </button>
        </div>
        <img :alt="alt" :src="src" class="mt-2 rounded-lg shadow-lg max-h-screen" />
      </div>
    </div>
  </div>
</template>
