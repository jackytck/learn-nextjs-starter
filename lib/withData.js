import React from 'react'
import cookie from 'cookie'
import PropTypes from 'prop-types'
import { ApolloProvider, getDataFromTree } from 'react-apollo'
import initApollo from './initApollo'
import initRedux from './initRedux'

function parseCookies (ctx = {}, options = {}) {
  let ck
  if (ctx.req) {
    ck = ctx.req.headers.cookie
  } else {
    ck = document.cookie
  }
  return cookie.parse(ck || '', options)
}

export default ComposedComponent => {
  return class WithData extends React.Component {
    static displayName = `WithData(${ComposedComponent.displayName})`
    static propTypes = {
      serverState: PropTypes.object.isRequired
    }

    static async getInitialProps (ctx) {
      let serverState = {}

      // Setup a server-side one-time-use apollo client for initial props and
      // rendering (on server)
      let apollo = initApollo({}, {
        getToken: () => parseCookies(ctx).token
      })

      // Evaluate the composed component's getInitialProps()
      let composedInitialProps = {}
      if (ComposedComponent.getInitialProps) {
        composedInitialProps = await ComposedComponent.getInitialProps(ctx, apollo)
      }

      // Run all graphql queries in the component tree
      // and extract the resulting data
      if (!process.browser) {
        if (ctx.res && ctx.res.finished) {
          // When redirecting, the response is finished.
          // No point in continuing to render
          return
        }

        const redux = initRedux(apollo)
        // Provide the `url` prop data in case a graphql query uses it
        const url = {query: ctx.query, pathname: ctx.pathname}

        // Run all graphql queries
        const app = (
          // No need to use the Redux Provider
          // because Apollo sets up the store for us
          <ApolloProvider client={apollo} store={redux}>
            <ComposedComponent url={url} {...composedInitialProps} />
          </ApolloProvider>
        )
        await getDataFromTree(app)

        // Extract query data from the store
        const state = redux.getState()

        // No need to include other initial Redux state because when it
        // initialises on the client-side it'll create it again anyway
        serverState = {
          apollo: { // Make sure to only include Apollo's data state
            data: state.apollo.data
          }
        }
      }

      return {
        serverState,
        ...composedInitialProps
      }
    }

    constructor (props) {
      super(props)
      this.apollo = initApollo(this.props.serverState, {
        getToken: () => parseCookies().token
      })
      this.redux = initRedux(this.apollo, this.props.serverState)
    }

    render () {
      return (
        // No need to use the Redux Provider
        // because Apollo sets up the store for us
        <ApolloProvider client={this.apollo} store={this.redux}>
          <ComposedComponent {...this.props} />
        </ApolloProvider>
      )
    }
  }
}
