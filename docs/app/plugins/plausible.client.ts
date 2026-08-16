export default defineNuxtPlugin(() => {
  const { plausibleScriptId } = useRuntimeConfig().public

  if (plausibleScriptId) {
    const script = useScriptPlausibleAnalytics({
      scriptId: plausibleScriptId,
      scriptOptions: { bundle: false, trigger: 'onNuxtReady' },
    })

    script.onLoaded(({ plausible }) => {
      const loadedPlausible: typeof plausible & { l?: boolean } = plausible
      if (!loadedPlausible.l)
        loadedPlausible.init({})
    })
  }
})
