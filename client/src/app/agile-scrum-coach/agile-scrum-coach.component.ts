import { Component } from '@angular/core';
import { Message, SystemMessageType } from '@shared/types';
import { ChatMessagesComponent } from 'app/chat-messages/chat-messages.component';
import { ChatToolbarComponent } from 'app/chat-toolbar/chat-toolbar.component';

@Component({
  selector: 'app-agile-scrum-coach',
  imports: [ChatToolbarComponent, ChatMessagesComponent],
  templateUrl: './agile-scrum-coach.component.html',
  styleUrl: './agile-scrum-coach.component.css'
})
export class AgileScrumCoachComponent {
  messages: Message[] = [];
  systemMessageType: SystemMessageType = 'agile-scrum-coach';


  onMessagesChanged(messages: Message[]) {
    this.messages = messages;
  }
}
