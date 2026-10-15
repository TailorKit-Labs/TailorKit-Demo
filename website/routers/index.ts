import { addNote, listActivities } from "./activities";
import { getChat, listChats } from "./chats";
import { createContact, deleteContact, getContact, listContacts, updateContact } from "./contacts";
import { createDeal, deleteDeal, listDeals, moveDeal, updateDeal } from "./deals";
import { createTask, deleteTask, listTasks, setTaskCompleted, updateTask } from "./tasks";
import { getWorkspace, provisionWorkspace, snapshotWorkspace } from "./workspace";

export const router = {
  workspace: { get: getWorkspace, snapshot: snapshotWorkspace, provision: provisionWorkspace },
  contacts: {
    list: listContacts,
    get: getContact,
    create: createContact,
    update: updateContact,
    delete: deleteContact,
  },
  deals: {
    list: listDeals,
    create: createDeal,
    update: updateDeal,
    delete: deleteDeal,
    move: moveDeal,
  },
  tasks: {
    list: listTasks,
    create: createTask,
    update: updateTask,
    delete: deleteTask,
    setCompleted: setTaskCompleted,
  },
  activities: { list: listActivities, addNote },
  chats: { get: getChat, list: listChats },
};
