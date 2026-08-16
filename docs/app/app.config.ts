export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'neutral',
    },
  },
  seo: {
    siteName: 'Nuxt OIDC Auth Documentation',
  },
  header: {
    logo: {
      alt: '~/assets/nuxt-oidc-auth.png',
      light: '~/assets/nuxt-oidc-auth.png',
      dark: '~/assets/nuxt-oidc-auth-dark.png',
    },
    search: true,
    colorMode: true,
    links: [{
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/itpropro/nuxt-oidc-auth',
      'target': '_blank',
      'aria-label': 'Nuxt OIDC Auth Documentation on GitHub',
    }],
  },
  footer: {
    credits: 'Copyright © 2024',
    colorMode: false,
    links: [{
      'icon': 'i-simple-icons-nuxtdotjs',
      'to': 'https://nuxt.com',
      'target': '_blank',
      'aria-label': 'Nuxt Website',
    }, {
      'icon': 'i-simple-icons-x',
      'to': 'https://x.com/jandamaschke',
      'target': '_blank',
      'aria-label': 'Jan-Henrik Damaschke X',
    }, {
      'icon': 'i-simple-icons-github',
      'to': 'https://github.com/itpropro/nuxt-oidc-auth',
      'target': '_blank',
      'aria-label': 'Nuxt OIDC Auth GitHub',
    }],
  },
  toc: {
    title: 'Table of Contents',
    bottom: {
      title: 'Community',
      // edit: 'https://github.com/nuxt-ui-pro/docs/edit/main/content',
      links: [{
        icon: 'i-carbon-star',
        label: 'Star on GitHub',
        to: 'https://github.com/itpropro/nuxt-oidc-auth',
        target: '_blank',
      }, {
        icon: 'i-carbon-block-storage',
        label: 'Nuxt modules',
        to: 'https://nuxt.com/modules/nuxt-oidc-auth',
        target: '_blank',
      }],
    },
  },
})
