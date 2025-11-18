
let errorHandler = null
let successHandler = null

export function useNotifications() {

    const setErrorHandler = (fn) => { errorHandler = fn }

    function emitError(summary, error) {
        if (errorHandler) {
            errorHandler(summary, error)
        } else {
            console.warn('Error:', summary, error)
        }
    }

    const setSuccessHandler = (fn) => { successHandler = fn }

    function emitSuccess(summary, detail) {
        if (successHandler) {
            successHandler(summary, detail)
        } else {
            console.log('Success:', summary, detail)
        }
    }

    return {
        setErrorHandler,
        setSuccessHandler,
        emitError,
        emitSuccess
    }
}