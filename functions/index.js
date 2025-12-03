/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.resolveMemberUidOnWorkspaceUpdate = functions.firestore
  .document('workspaces/{workspaceId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const workspaceId = context.params.workspaceId;

    const newMembers = newData.members || [];

    let needsUpdate = false;
    const updatedMembers = [...newMembers];
    const updatedMemberUids = [];

    // Iterate through current members to resolve UIDs and build updatedMemberUids
    for (let i = 0; i < updatedMembers.length; i++) {
      const member = updatedMembers[i];
      // If member has an email but no UID, try to resolve it
      if (member.email && !member.uid) {
        try {
          const userRecord = await admin.auth().getUserByEmail(member.email);
          if (userRecord.uid) {
            updatedMembers[i] = { ...member, uid: userRecord.uid };
            needsUpdate = true;
            console.log(`Resolved UID for ${member.email}: ${userRecord.uid}`);
          }
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            console.log(`User not found for email: ${member.email}. Skipping UID resolution.`);
          } else {
            console.error(`Error resolving UID for ${member.email}:`, error);
          }
        }
      }
      // Add the uid to the memberUids array if it exists
      if (updatedMembers[i].uid) {
        updatedMemberUids.push(updatedMembers[i].uid);
      }
    }

    // Ensure all UIDs from the 'members' array are also in 'memberUids' and are unique
    // This handles any discrepancies or missing UIDs in memberUids that might arise
    newMembers.forEach(member => {
        if (member.uid && !updatedMemberUids.includes(member.uid)) {
            updatedMemberUids.push(member.uid);
            needsUpdate = true;
        }
    });

    // Filter out nulls and ensure uniqueness in memberUids
    const finalMemberUids = updatedMemberUids.filter((uid, index, self) => uid !== null && self.indexOf(uid) === index);

    // Only update if there are actual changes to prevent infinite loops
    if (needsUpdate || JSON.stringify(newData.members) !== JSON.stringify(updatedMembers) || JSON.stringify(newData.memberUids) !== JSON.stringify(finalMemberUids)) {
        await admin.firestore().collection('workspaces').doc(workspaceId).update({
            members: updatedMembers,
            memberUids: finalMemberUids
        });
        console.log(`Workspace ${workspaceId} members and memberUids updated successfully.`);
    }

    return null;
  });
