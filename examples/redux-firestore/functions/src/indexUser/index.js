import { get } from 'lodash'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import { to } from '../utils/async'

/**
 * Function to index displayName. Triggered by user profile updates. Writes
 * data to users_public collection.
 * @param  {functions.Event} event - Firestore event from function being
 * triggered when user profile's change
 * @type {functions.CloudFunction}
 */
export default functions.firestore
  .document('/users/{userId}')
  .onWrite(indexUser)

/**
 * Index user's by placing their displayName into the users_public collection
 * @param  {functions.Event} event - Database event from function being
 * triggered when user profile's change
 * @return {Promise} Resolves with user's profile
 */
async function indexUser(event) {
  const { userId } = event.params || {}
  const publicProfileRef = admin
    .firestore()
    .collection('users_public')
    .doc(userId)

  // User Profile being deleted
  if (!event.data.exists) {
    console.log(
      `Profile being removed for user with id: ${userId}, removing from index...`
    )
    const [nameRemoveErr] = await to(publicProfileRef.delete())
    // Handle errors removing displayName index
    if (nameRemoveErr) {
      console.error(
        'Error running delete promises:',
        nameRemoveErr.message || nameRemoveErr
      )
      throw nameRemoveErr
    }
    console.log(`Successfully removed user with id: ${userId} from index.`)
    return null
  }

  const data = event.data.data()
  const previousData = event.data.previous.data()
  const oldDisplayName = get(previousData, 'displayName')
  // Check to see if displayName has changed
  if (oldDisplayName && oldDisplayName === get(data, 'displayName')) {
    console.log(
      `displayName parameter did not change for user with id: ${userId}, no need to update index. Exiting...`
    )
    return null
  }

  // Update displayName within index
  const [nameUpdateErr] = await to(
    publicProfileRef.update({
      displayName: data.displayName
    })
  )

  // Handle errors updating displayName index
  if (nameUpdateErr) {
    console.error(
      `Error running updating displayName index for profile with userId: ${userId}`,
      nameUpdateErr.message || nameUpdateErr
    )
    throw nameUpdateErr
  }

  return data
}