import React, {userEffect, userRef, useState} from 'react'
import imagePromiseFactory from './imagePromiseFactory'

export type useImageProps = {
  srcList: string | string[]
  imgPromise?: (...args: any[]) => Promise<void>
  useSuspense?: boolean
}

const removeBlankArrayElements = (a) => a.filter((x) => x)
const stringToArray = (x) => (Array.isArray(x) ? x : [x])
const cache = {}

// sequential map.find for promises
const promiseFind = (arr, promiseFactory) => {
  let done = false
  return new Promise((resolve, reject) => {
    const queueNext = (src) => {
      return promiseFactory(src).then(() => {
        done = true
        resolve(src)
      })
    }

    arr
      .reduce((p, src) => {
        // ensure we aren't done before enquing the next source
        return p.catch(() => {
          if (!done) return queueNext(src)
        })
      }, queueNext(arr.shift()))
      .catch(reject)
  })
}

export default function useImage({
  srcList,
  imgPromise = imagePromiseFactory({decode: true}),
  useSuspense = true,
}: useImageProps): {src: string | undefined; isLoading: boolean; error: any} {
  const [, setIsLoading] = useState(true)
  const sourceList = removeBlankArrayElements(stringToArray(srcList))
  const sourceKey = sourceList.join('')
  const isMounted = useRef(true)

  useEffect(() => {
    if (isMounted.current) {
      return () => {
        isMounted.current = false
      }
    }
  }, [])
  
  if (!cache[sourceKey]) {
    // create promise to loop through sources and try to load one
    cache[sourceKey] = {
      promise: promiseFind(sourceList, imgPromise),
      cache: 'pending',
      error: null,
    }
  }

  // when promise resolves/reject, update cache & state
  cache[sourceKey].promise
    // if a source was found, update cache
    // when not using suspense, update state to force a rerender
    .then((src) => {
      cache[sourceKey] = {...cache[sourceKey], cache: 'resolved', src}
      if (!useSuspense && isMounted.current) setIsLoading(false)
    })

    // if no source was found, or if another error occured, update cache
    // when not using suspense, update state to force a rerender
    .catch((error) => {
      cache[sourceKey] = {...cache[sourceKey], cache: 'rejected', error}
      if (!useSuspense && isMounted.current) setIsLoading(false)
    })

  if (cache[sourceKey].cache === 'resolved') {
    return {src: cache[sourceKey].src, isLoading: false, error: null}
  }

  if (cache[sourceKey].cache === 'rejected') {
    if (useSuspense) throw cache[sourceKey].error
    return {isLoading: false, error: cache[sourceKey].error, src: undefined}
  }

  // cache[sourceKey].cache === 'pending')
  if (useSuspense) throw cache[sourceKey].promise
  return {isLoading: true, src: undefined, error: null}
}
