export const createNotificationsMock = () => {
  const emitted = {
    errors: [],
    successes: []
  }
  return {
    emitted,
    useNotifications: () => ({
      emitError: (t, m) => emitted.errors.push({ t, m }),
      emitSuccess: (t, m) => emitted.successes.push({ t, m })
    })
  }
}
